import { describe, expect, it } from 'vitest'
import { percentualConcluido } from '../../pages/DashboardPage'

describe('percentualConcluido', () => {
  it('calcula o percentual arredondado e devolve 0 quando não há visitas planejadas', () => {
    expect(percentualConcluido(0, 0)).toBe(0)
    expect(percentualConcluido(1, 4)).toBe(25)
    expect(percentualConcluido(2, 3)).toBe(67)
  })
})
