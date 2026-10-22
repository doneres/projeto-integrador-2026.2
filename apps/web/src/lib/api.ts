import { type ErroDeCampo, problemaSchema } from '@axis/contracts'
import type { ZodType } from 'zod'
import { obterSessao, sessaoValida } from './sessao'

const BASE_URL = import.meta.env.VITE_API_URL ?? ''

/** Status usado quando não houve resposta do servidor (sem conexão ou servidor fora do ar). */
export const SEM_RESPOSTA = 0

type DadosDoErro = {
  status: number
  codigo: string
  mensagem: string
  erros?: ErroDeCampo[]
}

/** Erro de uma chamada à API, já traduzido do Problem Details (RFC 9457). */
export class ApiError extends Error {
  readonly status: number
  readonly codigo: string
  readonly erros: ErroDeCampo[]

  constructor({ status, codigo, mensagem, erros = [] }: DadosDoErro) {
    super(mensagem)
    this.name = 'ApiError'
    this.status = status
    this.codigo = codigo
    this.erros = erros
  }
}

/**
 * Chama a API e valida a resposta com o schema do contrato.
 * Toda falha vira ApiError: sem conexão, erro HTTP ou resposta fora do contrato.
 */
export async function apiFetch<T>(
  caminho: string,
  schema: ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const cabecalhos = new Headers(init?.headers)
  cabecalhos.set('Accept', 'application/json, application/problem+json')
  if (init?.body !== undefined && !cabecalhos.has('Content-Type')) {
    cabecalhos.set('Content-Type', 'application/json')
  }
  const sessao = obterSessao()
  if (sessaoValida(sessao) && !cabecalhos.has('Authorization')) {
    cabecalhos.set('Authorization', `Bearer ${sessao.token}`)
  }

  let resposta: Response
  try {
    resposta = await fetch(`${BASE_URL}${caminho}`, { ...init, headers: cabecalhos })
  } catch {
    throw new ApiError({
      status: SEM_RESPOSTA,
      codigo: 'SEM_CONEXAO',
      mensagem: 'Não foi possível conectar ao servidor.',
    })
  }

  if (!resposta.ok) {
    throw await erroDaResposta(resposta)
  }

  const corpo: unknown = resposta.status === 204 ? undefined : await resposta.json()
  const resultado = schema.safeParse(corpo)
  if (!resultado.success) {
    throw new ApiError({
      status: resposta.status,
      codigo: 'RESPOSTA_INVALIDA',
      mensagem: `A resposta de ${caminho} não segue o contrato da API.`,
    })
  }
  return resultado.data
}

async function erroDaResposta(resposta: Response): Promise<ApiError> {
  const corpo: unknown = await resposta.json().catch(() => undefined)
  const problema = problemaSchema.safeParse(corpo)
  if (problema.success) {
    return new ApiError({
      status: resposta.status,
      codigo: problema.data.codigo,
      mensagem: problema.data.detail ?? problema.data.title,
      erros: problema.data.erros,
    })
  }
  return new ApiError({
    status: resposta.status,
    codigo: 'ERRO_DESCONHECIDO',
    mensagem: `A API respondeu com o status ${resposta.status}.`,
  })
}
