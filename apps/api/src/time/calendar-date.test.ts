import { describe, expect, it } from 'vitest'
import { addCalendarDays, calendarDateInSaoPaulo, startOfDayInSaoPaulo } from './calendar-date'

describe('addCalendarDays', () => {
  it('soma dias atravessando mês e ano', () => {
    expect(addCalendarDays('2026-11-07', 1)).toBe('2026-11-08')
    expect(addCalendarDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('conhece o ano bissexto', () => {
    expect(addCalendarDays('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('startOfDayInSaoPaulo', () => {
  it('é a meia-noite de Brasília, 03h em UTC', () => {
    expect(startOfDayInSaoPaulo('2026-11-07').toISOString()).toBe('2026-11-07T03:00:00.000Z')
  })

  it('cai no próprio dia, e o instante anterior no dia de antes', () => {
    const start = startOfDayInSaoPaulo('2026-11-07')
    expect(calendarDateInSaoPaulo(start)).toBe('2026-11-07')
    expect(calendarDateInSaoPaulo(new Date(start.getTime() - 1))).toBe('2026-11-06')
  })
})

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
