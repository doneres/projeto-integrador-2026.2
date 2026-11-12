// Datas de calendário (YYYY-MM-DD) no fuso da operação, como o contrato define (#21).

const FUSO = 'America/Sao_Paulo'

/** Hoje em America/Sao_Paulo, no formato do contrato. Ex.: 2026-11-06 */
export function hojeEmSaoPaulo(agora: Date = new Date()): string {
  // en-CA formata como YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(agora)
}

/** 2026-11-06 → 06/11/2026 */
export function formatarData(data: string): string {
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

const HORA = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short', timeZone: FUSO })

/** Instante da API (UTC) → hora em São Paulo. Ex.: 2026-11-06T13:05:00Z → 10:05 */
export function formatarHora(instante: string): string {
  return HORA.format(new Date(instante))
}

const MES = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/** 2026-11 → novembro de 2026 */
export function formatarMes(mes: string): string {
  const [ano, numero] = mes.split('-')
  return MES.format(new Date(Date.UTC(Number(ano), Number(numero) - 1, 1)))
}
