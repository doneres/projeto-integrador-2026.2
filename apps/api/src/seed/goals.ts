import { eq, inArray } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import type { Database } from '../db/client'
import { goals, users } from '../db/schema'
import { firstDayOfMonth, monthOf, previousMonth, realizedByMonth } from '../goals/realized'
import { calendarDateInSaoPaulo } from '../time/calendar-date'

// Metas da camada demo (#70): derivadas do realizado semeado, para o Score cair em atingimentos
// planejados. Atingimento planejado = realizado / meta.

export type GoalPlan = {
  /** Matrícula do Vendedor. */
  registration: string
  /** Quanto do alvo o realizado representa: 1,2 = 120 % (o Score passa a ser 100 %, com o teto). */
  attainment: number
  /** Indicador deixado sem Meta de propósito. */
  skip?: 'revenue' | 'visits' | 'newCustomers'
}

/** Mês corrente: um Vendedor em cada situação, um indicador sem Meta e um Vendedor sem Meta. */
export const CURRENT_MONTH_PLAN: readonly GoalPlan[] = [
  { registration: '2001', attainment: 1.2 },
  { registration: '2002', attainment: 0.85 },
  { registration: '2003', attainment: 0.6 },
  { registration: '2004', attainment: 0.35 },
  { registration: '2005', attainment: 1, skip: 'newCustomers' },
]

/** Mês anterior, para o histórico: faturamento e visitas, com atingimentos variados. */
export const PREVIOUS_MONTH_PLAN: readonly GoalPlan[] = [
  { registration: '2001', attainment: 1.05, skip: 'newCustomers' },
  { registration: '2002', attainment: 0.9, skip: 'newCustomers' },
  { registration: '2003', attainment: 0.7, skip: 'newCustomers' },
  { registration: '2004', attainment: 0.5, skip: 'newCustomers' },
  { registration: '2005', attainment: 0.95, skip: 'newCustomers' },
  { registration: '2006', attainment: 0.8, skip: 'newCustomers' },
]

/**
 * Cria as Metas do mês corrente e do anterior que ainda não existem (por Vendedor e mês); a Meta
 * que já existe fica como está. Um indicador sem realizado no mês fica sem Meta, em vez de
 * virar uma Meta impossível de calcular.
 */
export async function seedGoals(db: Database, now: Date) {
  const [director] = await db.select().from(users).where(eq(users.role, 'director'))
  if (!director) throw new Error('Sem Diretor: rode a camada base antes.')

  const current = monthOf(calendarDateInSaoPaulo(now))
  const rounds = [
    { month: current, plan: CURRENT_MONTH_PLAN },
    { month: previousMonth(current), plan: PREVIOUS_MONTH_PLAN },
  ]

  const registrations = [
    ...new Set(rounds.flatMap((round) => round.plan.map((p) => p.registration))),
  ]
  const sellers = await db
    .select({ id: users.id, registration: users.registration })
    .from(users)
    .where(inArray(users.registration, registrations))
  const idOf = new Map(sellers.map((seller) => [seller.registration, seller.id]))

  const rows: (typeof goals.$inferInsert)[] = []
  for (const { month, plan } of rounds) {
    const realized = await realizedByMonth(db, month)
    for (const item of plan) {
      const sellerId = idOf.get(item.registration)
      if (!sellerId) continue
      const done = realized.get(sellerId)
      const target = (value: number | undefined, skipped: boolean, minimum = 0) =>
        !value || skipped ? null : Math.max(minimum, Math.round(value / item.attainment))
      const revenueTargetCents = target(done?.revenueCents, item.skip === 'revenue')
      const visitsTarget = target(done?.visits, item.skip === 'visits')
      const newCustomersTarget = target(done?.newCustomers, item.skip === 'newCustomers', 1)
      if (revenueTargetCents === null && visitsTarget === null && newCustomersTarget === null) {
        continue
      }
      rows.push({
        id: uuidv7(),
        sellerId,
        month: firstDayOfMonth(month),
        revenueTargetCents,
        visitsTarget,
        newCustomersTarget,
        setById: director.id,
      })
    }
  }

  if (rows.length === 0) return { goalsCreated: 0 }
  const created = await db
    .insert(goals)
    .values(rows)
    .onConflictDoNothing({ target: [goals.sellerId, goals.month] })
    .returning({ id: goals.id })
  return { goalsCreated: created.length }
}
