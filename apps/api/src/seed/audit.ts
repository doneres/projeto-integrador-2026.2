import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { Condition } from '@axis/contracts'
import { and, asc, eq, inArray, notExists } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import type { Database } from '../db/client'
import {
  auditItems,
  customers,
  loans,
  photos,
  posMaterials,
  routes,
  users,
  visits,
} from '../db/schema'
import { type PhotoStorage, photoKey } from '../storage/photo-storage'
import { addCalendarDays, calendarDateInSaoPaulo } from '../time/calendar-date'
import { DEMONSTRATION_CUSTOMERS, SEEDED_CUSTOMERS, SHOWCASE_SELLER, type Team } from './demo-data'

// Materiais de PDV, Comodatos, Auditorias e Fotos da camada demo (#69), consistentes com a RN03.

export const DEMO_MATERIALS = [
  { name: 'Geladeira Vertical 300 L', category: 'Geladeira' },
  { name: 'Freezer Horizontal 400 L', category: 'Freezer' },
  { name: 'Banner de Gôndola', category: 'Banner' },
  { name: 'Display de Balcão', category: 'Display' },
  { name: 'Totem Promocional', category: 'Totem' },
  { name: 'Expositor de Parede', category: 'Expositor' },
] as const

/** Os JPEGs fictícios versionados no repositório (960 × 720, uns 44 KB cada). */
export const DEMO_PHOTOS = {
  intact: 'geladeira-integra.jpg',
  damaged: 'freezer-avariado.jpg',
  maintenance: 'banner-manutencao.jpg',
  counter: 'display-balcao.jpg',
} as const

const ASSETS = new URL('./assets/', import.meta.url)

/** Comodatos ativos por parada da rota de hoje do showcase: 3, 2, 1, nenhum, 1 e 1. */
const SHOWCASE_STOP_LOANS = [3, 2, 1, 0, 1, 1]
/**
 * Comodatos ativos de dois Clientes da Equipe B, que nunca estão na rota do showcase (da Equipe A).
 * O primeiro tem ainda um Comodato encerrado, o do histórico.
 */
const EXTRA_CUSTOMER_LOANS = [2, 2]
/** Os Clientes de demonstração têm um Comodato cada, para o Check-in No Local virar Auditoria. */
const DEMONSTRATION_LOANS = 1

/** Estado de cada item auditado, em ciclo: o 1º é Avariado, o 2º Manutenção, o 3º Ausente. */
const CONDITION_CYCLE: readonly Condition[] = [
  'damaged',
  'needs_maintenance',
  'missing',
  'intact',
  'intact',
  'intact',
  'intact',
  'intact',
  'intact',
  'intact',
]
const MISSING_JUSTIFICATIONS = [
  'Cliente informou que o equipamento foi retirado para reforma.',
  'Equipamento não localizado no estabelecimento.',
]
const MINUTE_MS = 60 * 1000

type LoanPlan = {
  customerId: string
  slot: number
  /** O Comodato foi encerrado no início do mês corrente. */
  ended: boolean
}

/** Patrimônio estável por Cliente e posição: rodar de novo encontra o mesmo Comodato. */
const serialOf = (document: string, slot: number) => `PAT-${document.slice(-8)}-${slot + 1}`

/**
 * Cria o catálogo de Materiais, os Comodatos e as Auditorias com Fotos, só o que falta. As Fotos
 * são os JPEGs de `assets/`, enviados pela porta de storage uma vez; as linhas de `photo`
 * apontam para essas chaves (o seed reaproveita o mesmo arquivo em várias Visitas).
 */
export async function seedAudit(db: Database, storage: PhotoStorage, now: Date) {
  const today = calendarDateInSaoPaulo(now)
  const currentMonthStart = `${today.slice(0, 7)}-01`
  const installedAt = addCalendarDays(currentMonthStart, -50)

  // Materiais: pelo nome, sem tocar no que já existe.
  const knownMaterials = await db.select().from(posMaterials)
  const knownNames = new Set(knownMaterials.map((m) => m.name))
  const newMaterials = DEMO_MATERIALS.filter((m) => !knownNames.has(m.name))
  if (newMaterials.length > 0) {
    await db.insert(posMaterials).values(newMaterials.map((m) => ({ ...m, id: uuidv7() })))
  }
  const materials = (await db.select().from(posMaterials))
    .filter((m) => DEMO_MATERIALS.some((demo) => demo.name === m.name))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Fotos: o arquivo sobe pela porta, com a chave fixa.
  for (const name of Object.values(DEMO_PHOTOS)) {
    const bytes = await readFile(fileURLToPath(new URL(name, ASSETS)))
    await storage.put(photoKey(name), bytes, 'image/jpeg')
  }

  // Quem recebe Comodato.
  const customerRows = await db.select().from(customers)
  const byDocument = new Map(customerRows.map((c) => [c.document, c]))
  // Por Cliente: o maior número pedido por qualquer lista vale (um Cliente que é, ao mesmo tempo,
  // parada da rota e "extra" não ganha Comodatos em dobro).
  const wantedByCustomer = new Map<string, { count: number; endedExtra: boolean }>()
  const add = (customerId: string | undefined, count: number, endedExtra = false) => {
    if (!customerId || count === 0) return
    const current = wantedByCustomer.get(customerId)
    if (!current || count > current.count) wantedByCustomer.set(customerId, { count, endedExtra })
  }

  for (const demo of DEMONSTRATION_CUSTOMERS) {
    add(byDocument.get(demo.document)?.id, DEMONSTRATION_LOANS)
  }

  const [showcase] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.registration, SHOWCASE_SELLER.registration))
  if (showcase) {
    const stops = await db
      .select({ customerId: visits.customerId })
      .from(visits)
      .innerJoin(routes, eq(visits.routeId, routes.id))
      .where(and(eq(routes.sellerId, showcase.id), eq(routes.date, today)))
      .orderBy(asc(visits.position))
    stops.forEach((stop, index) => {
      add(stop.customerId, SHOWCASE_STOP_LOANS[index] ?? 0)
    })
  }

  const teamB: Team = 'B'
  const extras = SEEDED_CUSTOMERS.filter(
    (c) =>
      c.team === teamB &&
      c.origin === 'portfolio' &&
      c.status === 'active' &&
      !DEMONSTRATION_CUSTOMERS.some((demo) => demo.document === c.document),
  )
    .sort((a, b) => a.document.localeCompare(b.document))
    .slice(0, EXTRA_CUSTOMER_LOANS.length)
  extras.forEach((extra, index) => {
    add(byDocument.get(extra.document)?.id, EXTRA_CUSTOMER_LOANS[index] ?? 0, index === 0)
  })

  const plans: LoanPlan[] = []
  for (const [customerId, { count, endedExtra }] of wantedByCustomer) {
    for (let slot = 0; slot < count; slot++) plans.push({ customerId, slot, ended: false })
    if (endedExtra) plans.push({ customerId, slot: count, ended: true })
  }

  // Comodatos: pelo patrimônio. O primeiro Material de cada Cliente varia, para não repetir.
  const documentOf = new Map(customerRows.map((c) => [c.id, c.document]))
  const wanted = plans.map((plan, index) => ({
    plan,
    serialNumber: serialOf(documentOf.get(plan.customerId) as string, plan.slot),
    material: materials[(index * 5 + plan.slot) % materials.length],
  }))
  const knownSerials = new Set(
    (
      await db
        .select({ serial: loans.serialNumber })
        .from(loans)
        .where(
          inArray(
            loans.serialNumber,
            wanted.map((w) => w.serialNumber),
          ),
        )
    ).map((row) => row.serial),
  )
  const missingLoans = wanted.filter((w) => !knownSerials.has(w.serialNumber) && w.material)
  if (missingLoans.length > 0) {
    await db.insert(loans).values(
      missingLoans.map(({ plan, serialNumber, material }) => ({
        id: uuidv7(),
        materialId: (material as { id: string }).id,
        customerId: plan.customerId,
        serialNumber,
        installedAt,
        endedAt: plan.ended ? currentMonthStart : null,
      })),
    )
  }

  // Auditorias: as Visitas Concluídas de quem tem Comodato e ainda não foram auditadas.
  const loanRows = await db.select().from(loans)
  const pending = await db
    .select({ visit: visits, date: routes.date })
    .from(visits)
    .innerJoin(routes, eq(visits.routeId, routes.id))
    .where(
      and(
        inArray(visits.outcome, ['sale_made', 'audit_only']),
        inArray(visits.customerId, [...new Set(loanRows.map((loan) => loan.customerId))]),
        notExists(db.select().from(auditItems).where(eq(auditItems.visitId, visits.id))),
      ),
    )
    .orderBy(asc(routes.date), asc(routes.sellerId), asc(visits.position))

  const itemRows: (typeof auditItems.$inferInsert)[] = []
  const photoRows: (typeof photos.$inferInsert)[] = []
  let counter = 0
  for (const { visit, date } of pending) {
    if (!visit.checkedInAt || !visit.checkedOutAt) continue
    // Ativo no dia: instalado até a data e não encerrado antes dela.
    const active = loanRows
      .filter(
        (loan) =>
          loan.customerId === visit.customerId &&
          loan.installedAt <= date &&
          (loan.endedAt === null || loan.endedAt > date),
      )
      .sort((a, b) => a.serialNumber.localeCompare(b.serialNumber))
    if (active.length === 0) continue

    const middle = new Date((visit.checkedInAt.getTime() + visit.checkedOutAt.getTime()) / 2)
    for (const loan of active) {
      const condition = CONDITION_CYCLE[counter % CONDITION_CYCLE.length] as Condition
      const itemId = uuidv7()
      itemRows.push({
        id: itemId,
        visitId: visit.id,
        loanId: loan.id,
        condition,
        justification:
          condition === 'missing'
            ? (MISSING_JUSTIFICATIONS[counter % MISSING_JUSTIFICATIONS.length] as string)
            : null,
        occurredAt: middle,
      })
      if (condition === 'damaged' || condition === 'needs_maintenance') {
        photoRows.push({
          id: uuidv7(),
          visitId: visit.id,
          auditItemId: itemId,
          storageKey: photoKey(
            condition === 'damaged' ? DEMO_PHOTOS.damaged : DEMO_PHOTOS.maintenance,
          ),
          takenAt: new Date(middle.getTime() + MINUTE_MS),
        })
      }
      counter += 1
    }
    // Ao menos uma Foto por Visita auditada (RN03), do ponto de venda como um todo.
    photoRows.push({
      id: uuidv7(),
      visitId: visit.id,
      auditItemId: null,
      storageKey: photoKey(counter % 2 === 0 ? DEMO_PHOTOS.intact : DEMO_PHOTOS.counter),
      takenAt: new Date(middle.getTime() - MINUTE_MS),
    })
  }

  await db.transaction(async (tx) => {
    for (let start = 0; start < itemRows.length; start += 1000) {
      await tx.insert(auditItems).values(itemRows.slice(start, start + 1000))
    }
    for (let start = 0; start < photoRows.length; start += 1000) {
      await tx.insert(photos).values(photoRows.slice(start, start + 1000))
    }
  })

  return {
    materialsCreated: newMaterials.length,
    loansCreated: missingLoans.length,
    auditItemsCreated: itemRows.length,
    photosCreated: photoRows.length,
  }
}
