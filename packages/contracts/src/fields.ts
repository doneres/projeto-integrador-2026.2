import { z } from 'zod'

// Campos reaproveitados pelos schemas do contrato (cliente, visita).

/** Texto obrigatório e sem espaços nas pontas. Mensagens em português: aparecem na interface. */
export function requiredText(field: string, max: number) {
  return z.string().trim().min(1, `Informe ${field}`).max(max, `Use no máximo ${max} caracteres`)
}

/** UF brasileira em maiúsculas. Ex.: GO */
export const ufSchema = z.string().regex(/^[A-Z]{2}$/, 'A UF deve ter 2 letras. Ex.: GO')

/** CEP só com dígitos; a máscara 00000-000 é responsabilidade da interface. */
export const cepSchema = z.string().regex(/^\d{8}$/, 'O CEP deve ter 8 dígitos')

/** Telefone com DDD, só com dígitos: 10 (fixo) ou 11 (celular). */
export const telefoneSchema = z
  .string()
  .regex(/^\d{10,11}$/, 'Informe o telefone com DDD (10 ou 11 dígitos)')

export const latitudeSchema = z
  .number()
  .min(-90, 'A latitude vai de -90 a 90')
  .max(90, 'A latitude vai de -90 a 90')

export const longitudeSchema = z
  .number()
  .min(-180, 'A longitude vai de -180 a 180')
  .max(180, 'A longitude vai de -180 a 180')
