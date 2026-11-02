import type { ErroDeCampo, Problema } from '@axis/contracts'
import type { FastifyError, FastifyInstance } from 'fastify'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'

const PROBLEM_JSON = 'application/problem+json'

/** Título padrão por status HTTP, usado quando a rota não define um. */
const TITLES: Record<number, string> = {
  400: 'Requisição malformada',
  401: 'Não autenticado',
  403: 'Sem permissão',
  404: 'Não encontrado',
  409: 'Conflito',
  422: 'Dados inválidos',
  500: 'Erro interno',
}

/** Erro esperado de uma rota: vira Problem Details com o status e o `codigo` informados. */
export class ApiError extends Error {
  readonly status: number
  readonly codigo: string

  constructor(status: number, codigo: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.codigo = codigo
  }
}

/** `instancePath` do Ajv ("/address/zip") vira o caminho do campo ("address.zip"). */
function toFieldError(v: { instancePath: string; message?: string }): ErroDeCampo {
  return {
    campo: v.instancePath.replace(/^\//, '').replaceAll('/', '.'),
    mensagem: v.message ?? '',
  }
}

/** Responde todo erro no formato Problem Details (RFC 9457) definido em @axis/contracts. */
export function registerErrorHandling(app: FastifyInstance) {
  app.setNotFoundHandler((request, reply) => {
    const problem: Problema = {
      type: 'about:blank',
      title: TITLES[404] ?? 'Não encontrado',
      status: 404,
      detail: `Rota ${request.method} ${request.url} não existe`,
      codigo: 'NAO_ENCONTRADO',
    }
    return reply.code(404).type(PROBLEM_JSON).send(problem)
  })

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      const problem: Problema = {
        type: 'about:blank',
        title: TITLES[422] ?? 'Dados inválidos',
        status: 422,
        codigo: 'VALIDACAO',
        erros: error.validation.map(toFieldError),
      }
      return reply.code(422).type(PROBLEM_JSON).send(problem)
    }

    if (error instanceof ApiError) {
      const problem: Problema = {
        type: 'about:blank',
        title: TITLES[error.status] ?? 'Erro',
        status: error.status,
        detail: error.message,
        codigo: error.codigo,
      }
      // Só o token ausente ou inválido desafia com Bearer; a falha do login não.
      if (error.codigo === 'NAO_AUTENTICADO') reply.header('WWW-Authenticate', 'Bearer')
      return reply.code(error.status).type(PROBLEM_JSON).send(problem)
    }

    const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500
    if (status >= 500) request.log.error(error)
    const problem: Problema = {
      type: 'about:blank',
      title: TITLES[status] ?? 'Erro',
      status,
      // Erro 5xx não expõe a mensagem interna ao cliente.
      detail: status >= 500 ? undefined : error.message,
      codigo: status >= 500 ? 'ERRO_INTERNO' : 'REQUISICAO_INVALIDA',
    }
    return reply.code(status).type(PROBLEM_JSON).send(problem)
  })
}
