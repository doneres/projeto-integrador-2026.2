import { and, asc, eq, inArray } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import type { Database } from '../db/client'
import { customers, routes, visits } from '../db/schema'
import { type Coordinates, distanceInMeters } from '../geo/distance'
import {
  addCalendarDays,
  calendarDateInSaoPaulo,
  startOfDayInSaoPaulo,
} from '../time/calendar-date'
import { ensureUser, type SeedPasswords, seedBase } from './base'
import {
  COORDINATOR_B,
  DEFAULT_DEMO_LOCATION,
  DEMONSTRATION_CUSTOMERS,
  type DemoSeller,
  DISABLED_SELLER,
  demonstrationCustomerOf,
  routePlan,
  SEEDED_CUSTOMERS,
  type SellerKey,
  SHOWCASE_SELLER,
  TEST_SELLERS,
  type Team,
} from './demo-data'

export type DemoOptions = {
  passwords: SeedPasswords
  /** O dia da execução: todas as datas saem dele, no fuso America/Sao_Paulo. */
  now: Date
  /** Sobrescreve a coordenada do Cliente de demonstração, inclusive se ele já existir. */
  demoLocation?: Coordinates | undefined
}

const WORK_WINDOW_MS = 4 * 60 * 60 * 1000
/** Cerca de 22 m ao norte do Cliente: dentro do raio padrão de 100 m. */
const CHECK_IN_OFFSET_DEGREES = 0.0002

type CustomerRow = typeof customers.$inferSelect

/**
 * Camada demo, sobre a base: duas Equipes, Clientes e as rotas de hoje e de amanhã. Como a base,
 * só cria o que falta (por e-mail, matrícula, documento e Vendedor+data), então rodar de novo
 * preserva o que foi feito na demonstração; para recomeçar: reset + seed. A exceção é a coordenada
 * pedida em `demoLocation`, que vale também para o Cliente de demonstração que já existe.
 */
export async function seedDemo(db: Database, { passwords, now, demoLocation }: DemoOptions) {
  const { coordinator: coordinatorA, seller: showcase, ...report } = await seedBase(db, passwords)

  const coordinatorB = await ensureUser(db, report, {
    ...COORDINATOR_B,
    role: 'coordinator',
    password: passwords.coordinator,
  })
  const coordinatorOf: Record<Team, string> = { A: coordinatorA.id, B: coordinatorB.id }

  const ensureSeller = (seller: DemoSeller, active = true) =>
    ensureUser(db, report, {
      name: seller.name,
      email: seller.email,
      registration: seller.registration,
      role: 'seller',
      password: passwords.seller,
      coordinatorId: coordinatorOf[seller.team],
      active,
    })
  await ensureSeller(DISABLED_SELLER, false)
  const routeSellers: (SellerKey & { id: string })[] = [{ ...SHOWCASE_SELLER, id: showcase.id }]
  for (const seller of TEST_SELLERS) {
    routeSellers.push({ ...seller, id: (await ensureSeller(seller)).id })
  }
  const sellerIdByRegistration = new Map(routeSellers.map((s) => [s.registration, s.id]))

  // Pelo documento, e não por ON CONFLICT: o índice único ignora as Prospecções Rejeitadas.
  const documents = SEEDED_CUSTOMERS.map((customer) => customer.document)
  const findCustomers = () =>
    db.select().from(customers).where(inArray(customers.document, documents))
  const known = new Set((await findCustomers()).map((row) => row.document))
  const missing = SEEDED_CUSTOMERS.filter((customer) => !known.has(customer.document))

  if (missing.length > 0) {
    await db.insert(customers).values(
      missing.map(({ team, createdBy, approved, rejectionReason, ...customer }) => {
        const coordinatorId = coordinatorOf[team]
        return {
          ...customer,
          id: uuidv7(),
          complement: null,
          city: 'Goiânia',
          state: 'GO',
          coordinatorId,
          createdById: createdBy
            ? (sellerIdByRegistration.get(createdBy) as string)
            : coordinatorId,
          approvedById: approved ? coordinatorId : null,
          // Agora: no mês corrente, para contar como "novo cliente", e nunca no futuro.
          approvedAt: approved ? now : null,
          rejectionReason: rejectionReason ?? null,
        }
      }),
    )
  }

  if (demoLocation) {
    const demonstrationDocuments = DEMONSTRATION_CUSTOMERS.map((customer) => customer.document)
    await db
      .update(customers)
      .set(demoLocation)
      .where(inArray(customers.document, demonstrationDocuments))
  }

  const customerByDocument = new Map((await findCustomers()).map((row) => [row.document, row]))
  const today = calendarDateInSaoPaulo(now)

  const ensureRoute = async (
    sellerId: string,
    coordinatorId: string,
    date: string,
    plan: string[],
  ) => {
    // O Cliente pode ter sido inativado depois de semeado, e Inativo não entra em rota.
    const stops = plan
      .map((document) => customerByDocument.get(document))
      .filter((customer): customer is CustomerRow => customer?.status === 'active')
    if (stops.length === 0) return false

    // Numa transação: uma rota sem Visitas contaria como existente e nunca mais seria preenchida.
    return db.transaction(async (tx) => {
      const [route] = await tx
        .insert(routes)
        .values({ id: uuidv7(), sellerId, date, createdById: coordinatorId })
        .onConflictDoNothing()
        .returning()
      if (!route) return false
      await tx.insert(visits).values(
        stops.map((customer, index) => ({
          id: uuidv7(),
          routeId: route.id,
          customerId: customer.id,
          position: index + 1,
        })),
      )
      return true
    })
  }

  let routesCreated = 0
  for (const seller of routeSellers) {
    // Do lugar em que o Cliente de demonstração está agora, que pode vir de uma execução anterior.
    const origin =
      customerByDocument.get(demonstrationCustomerOf(seller.team).document) ?? DEFAULT_DEMO_LOCATION
    for (const dayOffset of [0, 1]) {
      const created = await ensureRoute(
        seller.id,
        coordinatorOf[seller.team],
        addCalendarDays(today, dayOffset),
        routePlan(seller, dayOffset, origin),
      )
      if (created) routesCreated += 1
    }
  }

  await executeShowcaseRoute(db, showcase.id, now)

  return { ...report, customersCreated: missing.length, routesCreated }
}

/**
 * Deixa a rota de hoje do showcase com duas Visitas Concluídas e uma Em andamento. Vale também
 * para a rota criada como "amanhã" numa execução anterior. Rota com qualquer Check-in fica como
 * está: alguém já mexeu nela.
 */
async function executeShowcaseRoute(db: Database, sellerId: string, now: Date) {
  const today = calendarDateInSaoPaulo(now)
  const stops = await db
    .select({ visit: visits, customer: customers })
    .from(visits)
    .innerJoin(routes, eq(visits.routeId, routes.id))
    .innerJoin(customers, eq(visits.customerId, customers.id))
    .where(and(eq(routes.sellerId, sellerId), eq(routes.date, today)))
    .orderBy(asc(visits.position))
  if (stops.some((row) => row.visit.checkedInAt)) return

  // Nas últimas horas e sem passar da meia-noite: rodando às 00h01, tudo fica nesse minuto.
  const begin = Math.max(startOfDayInSaoPaulo(today).getTime(), now.getTime() - WORK_WINDOW_MS)
  const at = (fraction: number) => new Date(begin + (now.getTime() - begin) * fraction)

  const checkIn = (customer: CustomerRow, instant: Date) => {
    const position = {
      latitude: customer.latitude + CHECK_IN_OFFSET_DEGREES,
      longitude: customer.longitude,
    }
    return {
      checkedInAt: instant,
      checkInLatitude: position.latitude,
      checkInLongitude: position.longitude,
      checkInAccuracyMeters: 12,
      checkInDistanceMeters: distanceInMeters(position, customer),
      checkInStatus: 'on_site' as const,
    }
  }

  const [first, second, third] = stops
  if (!first || !second || !third) return
  await db.transaction(async (tx) => {
    await tx
      .update(visits)
      .set({
        ...checkIn(first.customer, at(0.1)),
        checkedOutAt: at(0.3),
        outcome: 'sale_made',
        summary: 'Reposição de rotina.',
      })
      .where(eq(visits.id, first.visit.id))
    await tx
      .update(visits)
      .set({
        ...checkIn(second.customer, at(0.45)),
        checkedOutAt: at(0.6),
        outcome: 'audit_only',
        summary: 'Sem necessidade de reposição.',
      })
      .where(eq(visits.id, second.visit.id))
    await tx
      .update(visits)
      .set(checkIn(third.customer, at(0.85)))
      .where(eq(visits.id, third.visit.id))
  })
}
