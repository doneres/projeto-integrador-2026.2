import { describe, expect, it } from 'vitest'
import { dashboardFiltersSchema, dashboardSummarySchema } from './dashboard'

const resumoValido = {
  date: '2026-11-06',
  month: '2026-11',
  visits: {
    planned: 6,
    completed: 3,
    inProgress: 1,
    notPerformed: 1,
    pending: 1,
  },
  revenueCents: 184500,
  ordersCount: 4,
  visitsBySeller: [
    {
      sellerId: '0192f4a0-0000-7000-8000-0000000000a2',
      sellerName: 'Bruno Exemplo',
      planned: 4,
      completed: 2,
      inProgress: 1,
      notPerformed: 1,
    },
  ],
}

describe('dashboardSummarySchema', () => {
  it('aceita um resumo consolidado válido', () => {
    expect(dashboardSummarySchema.safeParse(resumoValido).success).toBe(true)
  })

  it('rejeita faturamento negativo ou mês fora do formato AAAA-MM', () => {
    expect(dashboardSummarySchema.safeParse({ ...resumoValido, revenueCents: -1 }).success).toBe(
      false,
    )
    expect(dashboardSummarySchema.safeParse({ ...resumoValido, month: '11/2026' }).success).toBe(
      false,
    )
  })
})

describe('dashboardFiltersSchema', () => {
  it('aceita data opcional no formato do calendário', () => {
    expect(dashboardFiltersSchema.safeParse({}).success).toBe(true)
    expect(dashboardFiltersSchema.safeParse({ date: '2026-11-06' }).success).toBe(true)
    expect(dashboardFiltersSchema.safeParse({ date: '06-11-2026' }).success).toBe(false)
  })
})
