import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import {
  type Condition,
  type LoanDetail,
  loanDetailSchema,
  pageOf,
  posMaterialSchema,
  rn03Violations,
  type VisitAudit,
  visitAuditSchema,
} from '@axis/contracts'
import { and, eq, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Harness, harness } from '../../test/support/demo-harness'
import { auditItems, customers, loans, photos, routes, users, visits } from '../db/schema'
import { photoKey } from '../storage/photo-storage'
import { DEMO_MATERIALS, DEMO_PHOTOS } from './audit'
import { DEMONSTRATION_CUSTOMERS } from './demo-data'

const NOW = new Date('2026-11-20T15:00:00Z')
const TODAY = '2026-11-20'

describe('seedAudit (Materiais, Comodatos, Auditorias e Fotos do seed demo)', () => {
  let h: Harness
  let loanPage: LoanDetail[]

  beforeAll(async () => {
    h = await harness(NOW)
    await h.seed(NOW)
    const response = await h.get('4001', '/v1/loans?perPage=100')
    expect(response.statusCode).toBe(200)
    loanPage = pageOf(loanDetailSchema).parse(response.json()).items
  })
  afterAll(() => h.finish())

  const auditOf = async (registration: string, visitId: string): Promise<VisitAudit> => {
    const response = await h.get(registration, `/v1/visits/${visitId}/audit`)
    expect(response.statusCode).toBe(200)
    return visitAuditSchema.parse(response.json())
  }

  /** Todas as Auditorias semeadas, lidas pela API como o Diretor as lê. */
  const allAudits = async () => {
    const audited = await h.db.selectDistinct({ id: auditItems.visitId }).from(auditItems)
    return Promise.all(audited.map(({ id }) => auditOf('3001', id)))
  }

  it('6 Materiais de PDV no catálogo', async () => {
    const response = await h.get('4001', '/v1/pos-materials?perPage=100')
    const materials = pageOf(posMaterialSchema).parse(response.json())
    expect(materials.total).toBe(6)
    expect(materials.items.map((m) => m.name).sort()).toEqual(
      DEMO_MATERIALS.map((m) => m.name).sort(),
    )
  })

  it('cerca de 14 Comodatos, um encerrado, todos com patrimônio e data de instalação', () => {
    expect(loanPage.length).toBeGreaterThanOrEqual(12)
    expect(loanPage.length).toBeLessThanOrEqual(16)
    expect(loanPage.filter((loan) => loan.endedAt !== null)).toHaveLength(1)
    for (const loan of loanPage) {
      expect(loan.serialNumber).toBeTruthy()
      expect(loan.installedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(loan.material?.name).toBeTruthy()
    }
    expect(new Set(loanPage.map((loan) => loan.serialNumber)).size).toBe(loanPage.length)
  })

  it('a rota de hoje do showcase tem Clientes com 2 ou 3 Comodatos ativos e um sem nenhum', async () => {
    const [showcase] = await h.db.select().from(users).where(eq(users.registration, '2001'))
    const stops = await h.db
      .select({ customerId: visits.customerId })
      .from(visits)
      .innerJoin(routes, eq(visits.routeId, routes.id))
      .where(and(eq(routes.sellerId, (showcase as { id: string }).id), eq(routes.date, TODAY)))
    const active = (customerId: string) =>
      loanPage.filter((loan) => loan.customerId === customerId && loan.endedAt === null).length
    const counts = stops.map((stop) => active(stop.customerId))

    expect(counts).toContain(0)
    expect(counts.some((count) => count >= 2 && count <= 3)).toBe(true)
    expect(Math.max(...counts)).toBe(3)
  })

  it('os Clientes de demonstração têm Comodato, para o Check-in No Local virar Auditoria', async () => {
    const documents = DEMONSTRATION_CUSTOMERS.map((customer) => customer.document)
    const demo = await h.db.select().from(customers).where(inArray(customers.document, documents))
    for (const customer of demo) {
      expect(loanPage.some((loan) => loan.customerId === customer.id && !loan.endedAt)).toBe(true)
    }
  })

  it('Auditorias com os quatro Estados de conservação; Ausente com justificativa', async () => {
    const seen = new Set<Condition>()
    for (const audit of await allAudits()) {
      for (const item of audit.items) {
        seen.add(item.condition)
        if (item.condition === 'missing') expect(item.justification).toBeTruthy()
      }
    }
    expect([...seen].sort()).toEqual(['damaged', 'intact', 'missing', 'needs_maintenance'])
  })

  describe('invariantes da RN03 sobre a massa semeada', () => {
    it('toda Visita auditada tem ao menos uma Foto; todo item Avariado ou em Manutenção tem a sua', async () => {
      const audits = await allAudits()
      expect(audits.length).toBeGreaterThan(10)
      for (const audit of audits) {
        expect(rn03Violations(audit), `Visita ${audit.visitId}`).toEqual([])
      }
    })

    it('só Visitas Concluídas são auditadas, com um item por Comodato ativo no dia', async () => {
      const rows = await h.db
        .select({ visit: visits, date: routes.date })
        .from(visits)
        .innerJoin(routes, eq(visits.routeId, routes.id))
        .where(
          inArray(
            visits.id,
            (await allAudits()).map((audit) => audit.visitId),
          ),
        )
      expect(rows.length).toBeGreaterThan(0)
      const loanRows = await h.db.select().from(loans)

      for (const { visit, date } of rows) {
        expect(['sale_made', 'audit_only']).toContain(visit.outcome)
        const expected = loanRows
          .filter(
            (loan) =>
              loan.customerId === visit.customerId &&
              loan.installedAt <= date &&
              (loan.endedAt === null || loan.endedAt > date),
          )
          .map((loan) => loan.id)
          .sort()
        const audited = (
          await h.db.select().from(auditItems).where(eq(auditItems.visitId, visit.id))
        )
          .map((item) => item.loanId)
          .sort()
        expect(audited).toEqual(expected)
      }
    })

    it('Cliente sem Comodato não passa por auditoria', async () => {
      const withLoan = new Set(loanPage.map((loan) => loan.customerId))
      const audited = await h.db
        .select({ customerId: visits.customerId })
        .from(auditItems)
        .innerJoin(visits, eq(auditItems.visitId, visits.id))
      expect(audited.every((row) => withLoan.has(row.customerId))).toBe(true)
    })

    it('a Auditoria não altera o Comodato: o encerrado segue encerrado e sem item depois', async () => {
      const ended = loanPage.find((loan) => loan.endedAt !== null)
      expect(ended).toBeDefined()
      const after = await h.db
        .select({ date: routes.date })
        .from(auditItems)
        .innerJoin(visits, eq(auditItems.visitId, visits.id))
        .innerJoin(routes, eq(visits.routeId, routes.id))
        .where(eq(auditItems.loanId, (ended as LoanDetail).id))
      expect(after.every((row) => row.date < (ended?.endedAt as string))).toBe(true)
    })
  })

  describe('Fotos', () => {
    it('os 4 JPEGs foram enviados pela porta de storage, dentro de 1280 px e 2 MB', async () => {
      for (const name of Object.values(DEMO_PHOTOS)) {
        const key = photoKey(name)
        expect(h.storage.keys.has(key)).toBe(true)
        expect(h.storage.keys.get(key) as number).toBeLessThan(2 * 1024 * 1024)

        const bytes = await readFile(fileURLToPath(new URL(`./assets/${name}`, import.meta.url)))
        expect([bytes[0], bytes[1]]).toEqual([0xff, 0xd8]) // assinatura JPEG
        // SOF0/SOF2: altura e largura do JPEG, sem biblioteca de imagem.
        let width = 0
        let height = 0
        for (let i = 2; i < bytes.length - 9; i++) {
          if (bytes[i] === 0xff && (bytes[i + 1] === 0xc0 || bytes[i + 1] === 0xc2)) {
            height = bytes.readUInt16BE(i + 5)
            width = bytes.readUInt16BE(i + 7)
            break
          }
        }
        expect(width).toBeGreaterThan(0)
        expect(Math.max(width, height)).toBeLessThanOrEqual(1280)
      }
    })

    it('toda linha de photo aponta para um arquivo enviado', async () => {
      const rows = await h.db.select({ key: photos.storageKey }).from(photos)
      expect(rows.length).toBeGreaterThan(0)
      for (const row of rows) expect(h.storage.keys.has(row.key)).toBe(true)
    })
  })

  describe('escopo', () => {
    it('o Vendedor lê a Auditoria da Visita dele; o de outra Equipe recebe 404', async () => {
      const [showcase] = await h.db.select().from(users).where(eq(users.registration, '2001'))
      const [mine] = await h.db
        .select({ id: auditItems.visitId })
        .from(auditItems)
        .innerJoin(visits, eq(auditItems.visitId, visits.id))
        .innerJoin(routes, eq(visits.routeId, routes.id))
        .where(eq(routes.sellerId, (showcase as { id: string }).id))
        .limit(1)
      expect(mine).toBeDefined()
      const own = await auditOf('2001', (mine as { id: string }).id)
      expect(own.items.length).toBeGreaterThan(0)

      const other = await h.get('2004', `/v1/visits/${(mine as { id: string }).id}/audit`)
      expect(other.statusCode).toBe(404)
      const admin = await h.get('4001', `/v1/visits/${(mine as { id: string }).id}/audit`)
      expect(admin.statusCode).toBe(403)
    })
  })

  it('rodar de novo não duplica Comodatos, itens nem Fotos', async () => {
    const counts = async () => [
      await h.db.$count(loans),
      await h.db.$count(auditItems),
      await h.db.$count(photos),
    ]
    const before = await counts()
    const report = await h.seed(NOW)
    expect([report.loansCreated, report.auditItemsCreated, report.photosCreated]).toEqual([0, 0, 0])
    expect(await counts()).toEqual(before)
  })
})
