import type { GoalsMonthlyReport, SellerScoreSummary } from '@axis/contracts'

const SELLER_ID = '0198f2a0-7c1e-7000-8000-000000000001'
const COORDINATOR_ID = '0198f2a0-7c1e-7000-8000-000000000002'

const indicator = (target: number | null, realized: number, weight: number) => {
  const percent = target ? Math.round((realized / target) * 100) : null
  return {
    target,
    realized,
    percent,
    cappedPercent: percent === null ? null : Math.min(percent, 100),
    weight,
  }
}

/** Score do mês de um Vendedor (faturamento em centavos). */
export function scoreSummary(overrides: Partial<SellerScoreSummary> = {}): SellerScoreSummary {
  return {
    sellerId: SELLER_ID,
    sellerName: 'Ana Souza',
    coordinatorId: COORDINATOR_ID,
    coordinatorName: 'Carla Lima',
    month: '2026-11',
    hasGoal: true,
    revenue: indicator(1_000_000, 850_000, 50),
    visits: indicator(40, 34, 30),
    newCustomers: indicator(5, 4, 20),
    score: 84,
    ...overrides,
  }
}

/** Resposta de `GET /v1/goals` para o Vendedor: só ele aparece. */
export function goalsReport(sellers: SellerScoreSummary[] = [scoreSummary()]): GoalsMonthlyReport {
  return {
    month: '2026-11',
    weights: { revenue: 50, visits: 30, newCustomers: 20 },
    sellers,
    overallScore: sellers[0]?.score ?? null,
  }
}
