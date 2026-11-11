import { type GoalInput, goalInputSchema } from '@axis/contracts'

export type ErrosFormularioMeta = Partial<Record<keyof GoalInput, string>>

export function reaisParaCentavos(valor: string): number | null {
  const limpo = valor.trim()
  if (!limpo) return null
  const apenasNumeros = limpo.replace(/[^\d.,]/g, '')
  if (apenasNumeros.includes(',')) {
    const semPonto = apenasNumeros.replace(/\./g, '')
    const pontoDecimal = semPonto.replace(',', '.')
    const float = Number.parseFloat(pontoDecimal)
    return Number.isNaN(float) ? null : Math.round(float * 100)
  }
  const float = Number.parseFloat(apenasNumeros)
  return Number.isNaN(float) ? null : Math.round(float * 100)
}

export function centavosParaReais(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined) return ''
  return (centavos / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function validarDadosMeta(valores: {
  faturamentoReais: string
  visitas: string
  novosClientes: string
}): { dados?: GoalInput; erros: ErrosFormularioMeta } {
  const faturamentoCentavos = reaisParaCentavos(valores.faturamentoReais)
  const visitas = valores.visitas.trim() ? Number.parseInt(valores.visitas.trim(), 10) : null
  const novosClientes = valores.novosClientes.trim()
    ? Number.parseInt(valores.novosClientes.trim(), 10)
    : null

  const erros: ErrosFormularioMeta = {}

  if (valores.visitas.trim() && (Number.isNaN(visitas) || (visitas !== null && visitas < 0))) {
    erros.visitsTarget = 'Informe um número de visitas válido (zero ou maior)'
  }

  if (
    valores.novosClientes.trim() &&
    (Number.isNaN(novosClientes) || (novosClientes !== null && novosClientes < 0))
  ) {
    erros.newCustomersTarget = 'Informe uma quantidade de clientes válida (zero ou maior)'
  }

  if (
    valores.faturamentoReais.trim() &&
    (faturamentoCentavos === null || faturamentoCentavos < 0)
  ) {
    erros.revenueTargetCents = 'Informe um valor de faturamento válido em reais'
  }

  if (Object.keys(erros).length > 0) {
    return { erros }
  }

  const bruto: GoalInput = {
    revenueTargetCents: faturamentoCentavos,
    visitsTarget: visitas,
    newCustomersTarget: novosClientes,
  }

  const validado = goalInputSchema.safeParse(bruto)
  if (validado.success) {
    return { dados: validado.data, erros: {} }
  }

  return { erros }
}
