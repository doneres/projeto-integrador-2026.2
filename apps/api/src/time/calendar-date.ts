const SAO_PAULO = 'America/Sao_Paulo'

// en-CA formata como AAAA-MM-DD, o formato de data de calendário do contrato.
const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SAO_PAULO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** A data de calendário ("2026-11-03") de um instante no fuso America/Sao_Paulo, o do negócio. */
export function calendarDateInSaoPaulo(instant: Date): string {
  return formatter.format(instant)
}

/** A data de calendário `days` dias depois. Conta em UTC, onde todo dia tem 24 horas. */
export function addCalendarDays(date: string, days: number): string {
  const instant = new Date(`${date}T00:00:00Z`)
  instant.setUTCDate(instant.getUTCDate() + days)
  return instant.toISOString().slice(0, 10)
}

/** O instante em que a data começa em São Paulo. O Brasil não tem horário de verão desde 2019. */
export function startOfDayInSaoPaulo(date: string): Date {
  return new Date(`${date}T00:00:00-03:00`)
}
