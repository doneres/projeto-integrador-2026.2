import { describe, expect, it } from 'vitest'
import {
  calcularAtingimento,
  calcularScoreRN02,
  DEFAULT_SCORE_WEIGHTS,
  goalSchema,
  scoreWeightsSchema,
} from './goal'

describe('scoreWeightsSchema', () => {
  it('aceita pesos padrão cuja soma é 100', () => {
    expect(scoreWeightsSchema.safeParse(DEFAULT_SCORE_WEIGHTS).success).toBe(true)
  })

  it('recusa pesos cuja soma difere de 100', () => {
    expect(
      scoreWeightsSchema.safeParse({ revenue: 50, visits: 30, newCustomers: 10 }).success,
    ).toBe(false)
  })
})

describe('goalSchema', () => {
  it('aceita meta mensal válida no formato AAAA-MM-01', () => {
    expect(
      goalSchema.safeParse({
        id: '0192f4a0-0000-7000-8000-000000000001',
        sellerId: '0192f4a0-0000-7000-8000-0000000000a2',
        month: '2026-11-01',
        revenueTargetCents: 5000000,
        visitsTarget: 40,
        newCustomersTarget: 5,
        setById: '0192f4a0-0000-7000-8000-0000000000a6',
        createdAt: '2026-11-01T10:00:00Z',
        updatedAt: '2026-11-01T10:00:00Z',
      }).success,
    ).toBe(true)
  })

  it('aceita metas parciais com indicadores nulos', () => {
    expect(
      goalSchema.safeParse({
        id: '0192f4a0-0000-7000-8000-000000000001',
        sellerId: '0192f4a0-0000-7000-8000-0000000000a2',
        month: '2026-11-01',
        revenueTargetCents: 5000000,
        visitsTarget: null,
        newCustomersTarget: null,
        setById: '0192f4a0-0000-7000-8000-0000000000a6',
        createdAt: '2026-11-01T10:00:00Z',
        updatedAt: '2026-11-01T10:00:00Z',
      }).success,
    ).toBe(true)
  })
})

describe('calcularAtingimento com teto de 100% (RN02)', () => {
  it('retorna null se a meta for nula ou menor/igual a zero', () => {
    expect(calcularAtingimento(100, null)).toEqual({ percent: null, cappedPercent: null })
    expect(calcularAtingimento(100, 0)).toEqual({ percent: null, cappedPercent: null })
  })

  it('calcula percentual exato quando abaixo de 100%', () => {
    expect(calcularAtingimento(80, 100)).toEqual({ percent: 80, cappedPercent: 80 })
  })

  it('aplica teto de 100% no cappedPercent quando realizado supera a meta', () => {
    expect(calcularAtingimento(150, 100)).toEqual({ percent: 150, cappedPercent: 100 })
  })
})

describe('calcularScoreRN02', () => {
  it('calcula score ponderado com pesos 50/30/20 quando todos os indicadores atingem a meta', () => {
    const res = calcularScoreRN02({
      revenue: { realized: 10000, target: 10000 },
      visits: { realized: 20, target: 20 },
      newCustomers: { realized: 5, target: 5 },
    })
    expect(res.score).toBe(100)
    expect(res.revenue.cappedPercent).toBe(100)
    expect(res.visits.cappedPercent).toBe(100)
    expect(res.newCustomers.cappedPercent).toBe(100)
  })

  it('aplica teto de 100% e não permite score acima de 100%', () => {
    const res = calcularScoreRN02({
      revenue: { realized: 30000, target: 10000 }, // 300% -> teto 100%
      visits: { realized: 40, target: 20 }, // 200% -> teto 100%
      newCustomers: { realized: 10, target: 5 }, // 200% -> teto 100%
    })
    expect(res.score).toBe(100)
    expect(res.revenue.percent).toBe(300)
    expect(res.revenue.cappedPercent).toBe(100)
  })

  it('calcula score proporcional quando faturamento está em 50%, visitas 100% e novos clientes 0%', () => {
    // Score = 0.50*50 + 0.30*100 + 0.20*0 = 25 + 30 + 0 = 55%
    const res = calcularScoreRN02({
      revenue: { realized: 5000, target: 10000 },
      visits: { realized: 20, target: 20 },
      newCustomers: { realized: 0, target: 5 },
    })
    expect(res.score).toBe(55)
  })

  it('retorna score null se nenhuma meta estiver definida', () => {
    const res = calcularScoreRN02({
      revenue: { realized: 5000, target: null },
      visits: { realized: 20, target: null },
      newCustomers: { realized: 3, target: null },
    })
    expect(res.score).toBeNull()
  })

  it('redistribui proporcionalmente os pesos quando apenas parte dos indicadores tem meta', () => {
    // Apenas faturamento (peso 50) tem meta. Realizado = 80%.
    // O score normalizado deve ser 80%.
    const res = calcularScoreRN02({
      revenue: { realized: 8000, target: 10000 },
      visits: { realized: 20, target: null },
      newCustomers: { realized: 3, target: null },
    })
    expect(res.score).toBe(80)
  })
})
