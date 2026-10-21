import { z } from 'zod'

/** Remove a máscara (pontos, barras, hífens e espaços) e passa as letras para maiúsculas. */
export function normalizarDocumento(texto: string): string {
  return texto.replace(/[.\-/\s]/g, '').toUpperCase()
}

/** Mantém só os dígitos. Ex.: "(62) 99999-0000" vira "62999990000". */
export function apenasDigitos(texto: string): string {
  return texto.replace(/\D/g, '')
}

/**
 * Dígito verificador no módulo 11: pesos a partir de 2, da direita para a esquerda,
 * voltando a 2 depois do peso máximo. Resto menor que 2 vira 0.
 */
function calcularDigito(valores: number[], pesoMaximo: number): number {
  let soma = 0
  let peso = 2
  for (let i = valores.length - 1; i >= 0; i--) {
    soma += valores[i] * peso
    peso = peso === pesoMaximo ? 2 : peso + 1
  }
  const resto = soma % 11
  return resto < 2 ? 0 : 11 - resto
}

/** CPF sem máscara: 11 dígitos com os 2 verificadores corretos. */
export function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) {
    return false
  }
  const digitos = [...cpf].map(Number)
  const primeiro = calcularDigito(digitos.slice(0, 9), Number.POSITIVE_INFINITY)
  const segundo = calcularDigito([...digitos.slice(0, 9), primeiro], Number.POSITIVE_INFINITY)
  return digitos[9] === primeiro && digitos[10] === segundo
}

/** No CNPJ alfanumérico, cada caractere vale o código ASCII menos 48: dígitos valem 0 a 9 e A vale 17. */
function valorNoCnpj(caractere: string): number {
  return caractere.charCodeAt(0) - 48
}

/**
 * CNPJ sem máscara: 12 caracteres alfanuméricos e 2 dígitos verificadores.
 * Aceita o formato numérico e o alfanumérico emitido pela Receita a partir de julho de 2026.
 */
export function cnpjValido(cnpj: string): boolean {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || /^(.)\1{13}$/.test(cnpj)) {
    return false
  }
  const valores = [...cnpj.slice(0, 12)].map(valorNoCnpj)
  const primeiro = calcularDigito(valores, 9)
  const segundo = calcularDigito([...valores, primeiro], 9)
  return Number(cnpj[12]) === primeiro && Number(cnpj[13]) === segundo
}

/** CPF (11 dígitos) ou CNPJ (14 caracteres), sem máscara e com os dígitos verificadores corretos. */
export const documentoSchema = z
  .string()
  .refine(
    (valor) => (valor.length === 11 ? cpfValido(valor) : cnpjValido(valor)),
    'CPF ou CNPJ inválido. Confira os dígitos.',
  )
