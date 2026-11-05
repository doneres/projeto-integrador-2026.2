import { describe, expect, it } from 'vitest'
import { formatarData, formatarHora, hojeEmSaoPaulo } from './datas'

describe('hojeEmSaoPaulo', () => {
  it('usa o dia de São Paulo, não o de UTC', () => {
    // 02:00 UTC do dia 6 ainda é 23:00 do dia 5 em São Paulo.
    expect(hojeEmSaoPaulo(new Date('2026-11-06T02:00:00Z'))).toBe('2026-11-05')
    expect(hojeEmSaoPaulo(new Date('2026-11-06T03:00:00Z'))).toBe('2026-11-06')
  })
})

describe('formatarData', () => {
  it('mostra a data no formato brasileiro', () => {
    expect(formatarData('2026-11-06')).toBe('06/11/2026')
  })
})

describe('formatarHora', () => {
  it('converte o instante UTC para a hora de São Paulo', () => {
    expect(formatarHora('2026-11-06T13:05:00Z')).toBe('10:05')
  })
})
