import { type ProductInput, productInputSchema } from '@axis/contracts'

/** Converte centavos em string de reais formatada para input numérico. Ex.: 1450 → "14,50" */
export function centavosParaReais(centavos: number): string {
  return (centavos / 100).toFixed(2).replace('.', ',')
}

/** Converte string em reais (com vírgula ou ponto) em número de centavos inteiro. Ex.: "14,50" → 1450 */
export function reaisParaCentavos(texto: string): number {
  const limpo = texto.trim().replace(/^R\$\s?/, '')
  if (!limpo) return 0
  let normalizado: string
  if (limpo.includes(',')) {
    // Formato brasileiro: 1.250,50 ou 4,50
    normalizado = limpo.replace(/\./g, '').replace(',', '.')
  } else {
    // Formato com ponto decimal: 4.50
    normalizado = limpo
  }
  const float = Number.parseFloat(normalizado)
  return Number.isNaN(float) ? 0 : Math.round(float * 100)
}

export type ErrosFormularioProduto = Partial<Record<keyof ProductInput, string>>

export function validarDadosProduto(dados: {
  sku: string
  name: string
  category: string
  preco: string
  referenceStock: string
  imageUrl: string
}): { dados?: ProductInput; erros: ErrosFormularioProduto } {
  const centavos = reaisParaCentavos(dados.preco)
  const estoque = Number.parseInt(dados.referenceStock, 10)

  const objetoParaValidar = {
    sku: dados.sku.trim().toUpperCase(),
    name: dados.name.trim(),
    category: dados.category.trim(),
    unitPriceCents: centavos,
    referenceStock: Number.isNaN(estoque) ? 0 : estoque,
    imageUrl: dados.imageUrl.trim() || undefined,
  }

  const resultado = productInputSchema.safeParse(objetoParaValidar)
  if (resultado.success) {
    return { dados: resultado.data, erros: {} }
  }

  const erros: ErrosFormularioProduto = {}
  for (const issue of resultado.error.issues) {
    const campo = issue.path[0] as keyof ProductInput
    if (campo && !erros[campo]) {
      erros[campo] = issue.message
    }
  }

  return { erros }
}
