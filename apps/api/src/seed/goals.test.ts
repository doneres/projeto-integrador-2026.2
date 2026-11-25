import { goalsMonthlyReportSchema, type SellerScoreSummary } from '@axis/contracts'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Harness, harness } from '../../test/support/demo-harness'
import { goals, users } from '../db/schema'

const NOW = new Date('2026-11-20T15:00:00Z')

describe('seedGoals (Metas e Score do seed demo)', () => {
  let h: Harness

  beforeAll(async () => {
    h = await harness(NOW)
    await h.seed(NOW)
  })
  afterAll(() => h.finish())

  const report = async (month: string) => {
    const response = await h.get('3001', `/v1/goals?month=${month}`)
    expect(response.statusCode).toBe(200)
    return goalsMonthlyReportSchema.parse(response.json())
  }

  const byRegistration = async (month: string) => {
    const rows = await h.db.select({ id: users.id, registration: users.registration }).from(users)
    const registrationOf = new Map(rows.map((row) => [row.id, row.registration]))
    const { sellers } = await report(month)
    return new Map<string, SellerScoreSummary>(
      sellers.map((seller) => [registrationOf.get(seller.sellerId) as string, seller]),
    )
  }

  it('o Score do mês corrente cai nas quatro situações planejadas', async () => {
    const current = await byRegistration('2026-11')
    const score = (registration: string) => current.get(registration)?.score as number

    expect(score('2001')).toBe(100) // acima de 100 %: o teto vale por indicador
    expect(score('2002')).toBeGreaterThanOrEqual(82)
    expect(score('2002')).toBeLessThanOrEqual(88)
    expect(score('2003')).toBeGreaterThanOrEqual(57)
    expect(score('2003')).toBeLessThanOrEqual(63)
    expect(score('2004')).toBeGreaterThanOrEqual(32)
    expect(score('2004')).toBeLessThanOrEqual(38)
  })

  it('o teto de 100 % vale por indicador, mesmo com o realizado acima da Meta', async () => {
    const top = (await byRegistration('2026-11')).get('2001') as SellerScoreSummary
    expect(top.revenue.percent).toBeGreaterThan(100)
    expect(top.revenue.cappedPercent).toBe(100)
    expect(top.visits.percent).toBeGreaterThan(100)
    expect(top.visits.cappedPercent).toBe(100)
    expect(top.score).toBeLessThanOrEqual(100)
  })

  it('um indicador sem Meta fica fora do Score; um Vendedor sem Meta tem Score nulo', async () => {
    const current = await byRegistration('2026-11')
    const partial = current.get('2005') as SellerScoreSummary
    expect(partial.hasGoal).toBe(true)
    expect(partial.newCustomers.target).toBeNull()
    expect(partial.newCustomers.cappedPercent).toBeNull()
    expect(partial.score).not.toBeNull()

    const none = current.get('2006') as SellerScoreSummary
    expect(none.hasGoal).toBe(false)
    expect(none.score).toBeNull()
  })

  it('o realizado vem do semeado: Pedidos, Visitas Concluídas e Prospecções aprovadas', async () => {
    const current = await byRegistration('2026-11')
    const showcase = current.get('2001') as SellerScoreSummary
    expect(showcase.revenue.realized).toBeGreaterThan(0)
    expect(showcase.visits.realized).toBeGreaterThan(0)
    // A Prospecção aprovada do showcase é do mês corrente (aprovada na execução do seed).
    expect(showcase.newCustomers.realized).toBe(1)
  })

  it('há Metas do mês anterior para o histórico', async () => {
    const previous = await byRegistration('2026-10')
    const withGoal = [...previous.values()].filter((seller) => seller.hasGoal)
    expect(withGoal.length).toBeGreaterThanOrEqual(5)
    for (const seller of withGoal) {
      expect(seller.revenue.target).toBeGreaterThan(0)
      expect(seller.score).toBeGreaterThan(0)
      expect(seller.score).toBeLessThanOrEqual(100)
    }
  })

  it('rodar de novo não duplica nem recalcula as Metas', async () => {
    const before = await h.db.$count(goals)
    const [goal] = await h.db.select().from(goals).limit(1)
    const report = await h.seed(NOW)
    expect(report.goalsCreated).toBe(0)
    expect(await h.db.$count(goals)).toBe(before)
    const [again] = await h.db
      .select()
      .from(goals)
      .where(eq(goals.id, (goal as { id: string }).id))
    expect(again).toEqual(goal)
  })
})
