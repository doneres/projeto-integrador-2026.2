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
