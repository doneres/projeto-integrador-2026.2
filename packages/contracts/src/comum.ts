import { z } from 'zod'

// Convenções do contrato da API definidas na issue #21.

/** Identificador: UUID em texto. Pode ser gerado pelo app, para registros criados offline. */
export const idSchema = z.uuid()

/** Instante no tempo: ISO 8601 em UTC, terminado em "Z". Ex.: 2026-11-06T13:00:00Z */
export const instanteSchema = z.iso.datetime()

/** Data de calendário, sem horário, no fuso America/Sao_Paulo. Ex.: 2026-11-06 */
export const dataCalendarioSchema = z.iso.date()

/** Dinheiro: inteiro em centavos (R$ 12,34 = 1234). */
export const centavosSchema = z.number().int().min(0)

// A paginação fica em ./pagination (`paginationSchema`, `pageOf`).

/** Erro de validação de um campo específico. */
export const erroDeCampoSchema = z.object({
  campo: z.string(),
  mensagem: z.string(),
})
export type ErroDeCampo = z.infer<typeof erroDeCampoSchema>

/**
 * Corpo de erro da API no formato Problem Details (RFC 9457), enviado com
 * Content-Type application/problem+json. A extensão `codigo` é o que web e
 * mobile usam para escolher a mensagem mostrada ao usuário.
 */
export const problemaSchema = z.object({
  type: z.string().default('about:blank'),
  title: z.string(),
  status: z.number().int().min(400).max(599),
  detail: z.string().optional(),
  instance: z.string().optional(),
  codigo: z.string().min(1),
  erros: z.array(erroDeCampoSchema).optional(),
})
export type Problema = z.infer<typeof problemaSchema>

/** Converte os problemas de validação do Zod na lista `erros` do Problem Details. */
export function errosDeValidacao(erro: z.ZodError): ErroDeCampo[] {
  return erro.issues.map((issue) => ({
    campo: issue.path.map(String).join('.'),
    mensagem: issue.message,
  }))
}
