import { describe, expect, it } from 'vitest'
import { calendarDateInSaoPaulo } from './calendar-date'

describe('calendarDateInSaoPaulo', () => {
  it('usa o dia de São Paulo, não o de UTC: 23h de Brasília já é o dia seguinte em UTC', () => {
    expect(calendarDateInSaoPaulo(new Date('2026-11-04T02:30:00Z'))).toBe('2026-11-03')
  })

  it('vira o dia à meia-noite de Brasília (03h UTC)', () => {
    expect(calendarDateInSaoPaulo(new Date('2026-11-04T02:59:59Z'))).toBe('2026-11-03')
    expect(calendarDateInSaoPaulo(new Date('2026-11-04T03:00:00Z'))).toBe('2026-11-04')
  })

  it('devolve data de calendário com zeros à esquerda', () => {
    expect(calendarDateInSaoPaulo(new Date('2026-01-05T15:00:00Z'))).toBe('2026-01-05')
  })
})
