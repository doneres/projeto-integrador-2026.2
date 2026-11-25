import { calcularAtingimento, calcularScoreRN02, DEFAULT_SCORE_WEIGHTS } from '@axis/contracts'
import { describe, expect, it } from 'vitest'

describe('Metas e Score RN02 (RF18, RF23, #43, #63)', () => {
  it('aplica teto de 100% no atingimento do indicador', () => {
    // 15000 de 10000 = 150%, mas capped = 100%
    const { percent, cappedPercent } = calcularAtingimento(15000, 10000)
    expect(percent).toBe(150)
    expect(cappedPercent).toBe(100)
  })

  it('calcula score ponderado com pesos 50/30/20 respeitando o teto de 100%', () => {
    const res = calcularScoreRN02(
      {
        revenue: { realized: 2000000, target: 1000000 }, // 200% -> teto 100%
        visits: { realized: 50, target: 25 }, // 200% -> teto 100%
        newCustomers: { realized: 10, target: 5 }, // 200% -> teto 100%
      },
      DEFAULT_SCORE_WEIGHTS,
    )

    // Score não pode ultrapassar 100%
    expect(res.score).toBe(100)
  })

  it('calcula score proporcional quando faturamento está abaixo da meta', () => {
    // Faturamento: 5000 de 10000 (50%) -> 0.50 * 50 = 25
    // Visitas: 20 de 20 (100%) -> 0.30 * 100 = 30
    // Novos clientes: 2 de 4 (50%) -> 0.20 * 50 = 10
    // Total esperado = 25 + 30 + 10 = 65%
    const res = calcularScoreRN02(
      {
        revenue: { realized: 5000, target: 10000 },
        visits: { realized: 20, target: 20 },
        newCustomers: { realized: 2, target: 4 },
      },
      DEFAULT_SCORE_WEIGHTS,
    )

    expect(res.score).toBe(65)
  })

  it('retorna score nulo quando o vendedor não possui meta cadastrada', () => {
    const res = calcularScoreRN02({
      revenue: { realized: 10000, target: null },
      visits: { realized: 15, target: null },
      newCustomers: { realized: 1, target: null },
    })

    expect(res.score).toBeNull()
  })
})
