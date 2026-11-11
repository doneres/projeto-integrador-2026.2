import {
  type LoanEnd,
  type LoanInput,
  loanEndSchema,
  loanInputSchema,
  type PosMaterialInput,
  posMaterialInputSchema,
} from '@axis/contracts'

export type ErrosFormularioMaterial = Partial<Record<keyof PosMaterialInput, string>>
export type ErrosFormularioComodato = Partial<Record<keyof LoanInput, string>>
export type ErrosFormularioEncerramento = Partial<Record<keyof LoanEnd, string>>

export function validarDadosMaterial(valores: { name: string; category: string }): {
  dados?: PosMaterialInput
  erros: ErrosFormularioMaterial
} {
  const bruto = {
    name: valores.name.trim(),
    category: valores.category.trim(),
  }

  const resultado = posMaterialInputSchema.safeParse(bruto)
  if (resultado.success) {
    return { dados: resultado.data, erros: {} }
  }

  const erros: ErrosFormularioMaterial = {}
  for (const issue of resultado.error.issues) {
    const campo = issue.path[0] as keyof PosMaterialInput
    if (campo && !erros[campo]) {
      erros[campo] = issue.message
    }
  }

  return { erros }
}

export function validarDadosComodato(valores: {
  materialId: string
  customerId: string
  serialNumber: string
  installedAt: string
}): { dados?: LoanInput; erros: ErrosFormularioComodato } {
  const bruto = {
    materialId: valores.materialId.trim(),
    customerId: valores.customerId.trim(),
    serialNumber: valores.serialNumber.trim(),
    installedAt: valores.installedAt.trim(),
  }

  const resultado = loanInputSchema.safeParse(bruto)
  if (resultado.success) {
    return { dados: resultado.data, erros: {} }
  }

  const erros: ErrosFormularioComodato = {}
  for (const issue of resultado.error.issues) {
    const campo = issue.path[0] as keyof LoanInput
    if (campo && !erros[campo]) {
      erros[campo] = issue.message
    }
  }

  return { erros }
}

export function validarDadosEncerramento(valores: { endedAt: string; installedAt: string }): {
  dados?: LoanEnd
  erros: ErrosFormularioEncerramento
} {
  const bruto = {
    endedAt: valores.endedAt.trim(),
  }

  const resultado = loanEndSchema.safeParse(bruto)
  if (!resultado.success) {
    return {
      erros: {
        endedAt: resultado.error.issues[0]?.message ?? 'Data de encerramento inválida',
      },
    }
  }

  if (valores.installedAt && bruto.endedAt < valores.installedAt) {
    return {
      erros: {
        endedAt: 'A data de encerramento não pode ser anterior à data de instalação.',
      },
    }
  }

  return { dados: resultado.data, erros: {} }
}
