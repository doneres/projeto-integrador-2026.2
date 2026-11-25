import {
  type CustomerInput,
  type CustomerSortField,
  customerFiltersSchema,
  customerInputSchema,
  customerRejectionSchema,
  customerSchema,
  customerStatusChangeSchema,
  idSchema,
  normalizarDocumento,
  pageOf,
  problemaSchema,
  type User,
} from '@axis/contracts'
import { and, asc, desc, eq, ilike, inArray, or, type SQL } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { v7 as uuidv7 } from 'uuid'
import { z } from 'zod'
import { customerScope, requireRole } from '../access/scope'
import { toCustomer } from '../customers/to-customer'
import { isUniqueViolation } from '../db/errors'
import { customers } from '../db/schema'
import { ApiError } from '../errors'

const DOCUMENT_UNIQUE_INDEX = 'customer_document_unique'

const SORT_COLUMNS = {
  tradeName: customers.tradeName,
  legalName: customers.legalName,
  city: customers.city,
  district: customers.district,
  createdAt: customers.createdAt,
} satisfies Record<CustomerSortField, unknown>

/** Escapa `\`, `%` e `_` para que a busca os trate como texto comum no LIKE. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, '\\$&')
}

/** Nome fantasia, razão social ou CPF/CNPJ (com ou sem máscara) que contenham o texto. */
function searchCondition(search: string): SQL | undefined {
  const term = search.trim()
  if (!term) return undefined
  const byName = `%${escapeLike(term)}%`
  const document = normalizarDocumento(term)
  return or(
    ilike(customers.tradeName, byName),
    ilike(customers.legalName, byName),
    // O CPF/CNPJ só tem dígitos e letras: um termo com outros caracteres não casa com nenhum.
    /^[0-9A-Z]+$/.test(document) ? ilike(customers.document, `%${document}%`) : undefined,
  )
}

function inputToRow(input: CustomerInput) {
  return { ...input, complement: input.complement || null }
}

/**
 * Clientes. Leitura no escopo do perfil (Vendedor: os das suas rotas e as suas prospecções;
 * Coordenador: a Equipe; Diretor: todos). Cadastro, edição e inativação são do Coordenador, e só
 * nos clientes da própria Equipe. Cliente nunca é excluído: inativa-se.
 */
export async function customerRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>()
  const security = [{ bearerAuth: [] }]
  const params = z.object({ id: idSchema })

  /** O cliente se estiver no escopo de leitura do usuário; senão 404 (igual a não existir). */
  async function findVisible(user: User, id: string) {
    const [row] = await app.db
      .select()
      .from(customers)
      .where(and(eq(customers.id, id), customerScope(app.db, user)))
    if (!row) throw new ApiError(404, 'NAO_ENCONTRADO', 'Cliente não encontrado')
    return row
  }

  /** O cliente da Equipe do coordenador logado, para alterar. Outra equipe: 404. */
  async function findOwned(user: User, id: string) {
    requireRole(user, 'coordinator')
    return findVisible(user, id)
  }

  async function saveDocumentSafely<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      if (isUniqueViolation(error, DOCUMENT_UNIQUE_INDEX)) {
        throw new ApiError(409, 'DOCUMENTO_JA_CADASTRADO', 'Já existe um cliente com este CPF/CNPJ')
      }
      throw error
    }
  }

  typed.get(
    '/v1/customers',
    {
      onRequest: app.authenticate,
      schema: {
        tags: ['customers'],
        summary: 'Lista clientes do escopo do perfil',
        description:
          'Paginação (`page`, `perPage`), busca (`search`: nome fantasia, razão social ou CPF/CNPJ), filtros (`status`, `origin`, `district`) e ordenação (`sortBy`, `order`).',
        security,
        querystring: customerFiltersSchema,
        response: {
          200: pageOf(customerSchema),
          401: problemaSchema,
          403: problemaSchema,
          422: problemaSchema,
        },
      },
    },
    async (request) => {
      const { page, perPage, search, status, origin, district, sortBy, order } = request.query
      const where = and(
        customerScope(app.db, request.user),
        search ? searchCondition(search) : undefined,
        status ? eq(customers.status, status) : undefined,
        origin ? eq(customers.origin, origin) : undefined,
        district ? eq(customers.district, district) : undefined,
      )
      const direction = order === 'desc' ? desc : asc
      const [total, rows] = await Promise.all([
        app.db.$count(customers, where),
        app.db
          .select()
          .from(customers)
          .where(where)
          // O id desempata: sem ele, a página pode repetir ou perder clientes de mesmo nome.
          .orderBy(direction(SORT_COLUMNS[sortBy]), asc(customers.id))
          .limit(perPage)
          .offset((page - 1) * perPage),
      ])
      return { items: rows.map(toCustomer), total, page, perPage }
    },
  )

  typed.get(
    '/v1/customers/:id',
    {
      onRequest: app.authenticate,
      schema: {
        tags: ['customers'],
        summary: 'Detalha um cliente do escopo do perfil',
        security,
        params,
        response: {
          200: customerSchema,
          401: problemaSchema,
          403: problemaSchema,
          404: problemaSchema,
          422: problemaSchema,
        },
      },
    },
    async (request) => toCustomer(await findVisible(request.user, request.params.id)),
  )

  typed.post(
    '/v1/customers',
    {
      onRequest: app.authenticate,
      schema: {
        tags: ['customers'],
        summary: 'Cadastra um cliente de carteira (Coordenador)',
        description:
          'Nasce ativo e da Equipe do Coordenador. As coordenadas são obrigatórias. 409 DOCUMENTO_JA_CADASTRADO se o CPF/CNPJ já é de outro cliente.',
        security,
        body: customerInputSchema,
        response: {
          201: customerSchema,
          401: problemaSchema,
          403: problemaSchema,
          409: problemaSchema,
          422: problemaSchema,
        },
      },
    },
    async (request, reply) => {
      requireRole(request.user, 'coordinator')
      const [row] = await saveDocumentSafely(() =>
        app.db
          .insert(customers)
          .values({
            ...inputToRow(request.body),
            id: uuidv7(),
            origin: 'portfolio',
            status: 'active',
            coordinatorId: request.user.id,
            createdById: request.user.id,
          })
          .returning(),
      )
      if (!row) throw new Error('Falha ao cadastrar o cliente')
      return reply.code(201).send(toCustomer(row))
    },
  )

  typed.put(
    '/v1/customers/:id',
    {
      onRequest: app.authenticate,
      schema: {
        tags: ['customers'],
        summary: 'Edita os dados de um cliente da Equipe (Coordenador)',
        description: 'Não altera origem, estado nem dono; o estado muda em `/status`.',
        security,
        params,
        body: customerInputSchema,
        response: {
          200: customerSchema,
          401: problemaSchema,
          403: problemaSchema,
          404: problemaSchema,
          409: problemaSchema,
          422: problemaSchema,
        },
      },
    },
    async (request) => {
      const current = await findOwned(request.user, request.params.id)
      const [row] = await saveDocumentSafely(() =>
        app.db
          .update(customers)
          .set(inputToRow(request.body))
          .where(eq(customers.id, current.id))
          .returning(),
      )
      if (!row) throw new Error('Falha ao editar o cliente')
      return toCustomer(row)
    },
  )

  typed.patch(
    '/v1/customers/:id/status',
    {
      onRequest: app.authenticate,
      schema: {
        tags: ['customers'],
        summary: 'Inativa ou reativa um cliente da Equipe (Coordenador)',
        description:
          'O cliente nunca é excluído: o inativo sai das rotas novas e continua no histórico. Só vale para cliente ativo ou inativo; prospecção pendente ou rejeitada responde 409 TRANSICAO_INVALIDA.',
        security,
        params,
        body: customerStatusChangeSchema,
        response: {
          200: customerSchema,
          401: problemaSchema,
          403: problemaSchema,
          404: problemaSchema,
          409: problemaSchema,
          422: problemaSchema,
        },
      },
    },
    async (request) => {
      const current = await findOwned(request.user, request.params.id)
      if (current.status !== 'active' && current.status !== 'inactive') {
        throw new ApiError(
          409,
          'TRANSICAO_INVALIDA',
          'Só cliente ativo ou inativo pode ser inativado ou reativado',
        )
      }
      const [row] = await app.db
        .update(customers)
        .set({ status: request.body.status })
        // Confere o estado no próprio UPDATE: uma aprovação ou rejeição concorrente não é sobrescrita.
        .where(and(eq(customers.id, current.id), inArray(customers.status, ['active', 'inactive'])))
        .returning()
      if (!row) {
        throw new ApiError(
          409,
          'TRANSICAO_INVALIDA',
          'O estado do cliente mudou; recarregue e tente de novo',
        )
      }
      return toCustomer(row)
    },
  )

  typed.post(
    '/v1/customers/:id/approval',
    {
      onRequest: app.authenticate,
      schema: {
        tags: ['customers'],
        summary: 'Aprova uma prospecção da Equipe (Coordenador)',
        description:
          'Passa a prospecção de pending_approval para active, gravando quem aprovou e quando (RF09, RN04). Só vale para prospecção com aprovação pendente; outro estado responde 409 TRANSICAO_INVALIDA.',
        security,
        params,
        response: {
          200: customerSchema,
          401: problemaSchema,
          403: problemaSchema,
          404: problemaSchema,
          409: problemaSchema,
          422: problemaSchema,
        },
      },
    },
    async (request) => {
      const current = await findOwned(request.user, request.params.id)
      if (current.origin !== 'prospect' || current.status !== 'pending_approval') {
        throw new ApiError(
          409,
          'TRANSICAO_INVALIDA',
          'Só prospecção com aprovação pendente pode ser aprovada',
        )
      }
      const now = new Date()
      const [row] = await app.db
        .update(customers)
        .set({
          status: 'active',
          approvedById: request.user.id,
          approvedAt: now,
          updatedAt: now,
        })
        .where(and(eq(customers.id, current.id), eq(customers.status, 'pending_approval')))
        .returning()
      if (!row) {
        throw new ApiError(
          409,
          'TRANSICAO_INVALIDA',
          'O estado do cliente mudou; recarregue e tente de novo',
        )
      }
      return toCustomer(row)
    },
  )

  typed.post(
    '/v1/customers/:id/rejection',
    {
      onRequest: app.authenticate,
      schema: {
        tags: ['customers'],
        summary: 'Rejeita uma prospecção da Equipe com motivo (Coordenador)',
        description:
          'Passa a prospecção de pending_approval para rejected, gravando o motivo no histórico (RF09, RN04). Só vale para prospecção com aprovação pendente; outro estado responde 409 TRANSICAO_INVALIDA.',
        security,
        params,
        body: customerRejectionSchema,
        response: {
          200: customerSchema,
          401: problemaSchema,
          403: problemaSchema,
          404: problemaSchema,
          409: problemaSchema,
          422: problemaSchema,
        },
      },
    },
    async (request) => {
      const current = await findOwned(request.user, request.params.id)
      if (current.origin !== 'prospect' || current.status !== 'pending_approval') {
        throw new ApiError(
          409,
          'TRANSICAO_INVALIDA',
          'Só prospecção com aprovação pendente pode ser rejeitada',
        )
      }
      const now = new Date()
      const [row] = await app.db
        .update(customers)
        .set({
          status: 'rejected',
          rejectionReason: request.body.reason,
          updatedAt: now,
        })
        .where(and(eq(customers.id, current.id), eq(customers.status, 'pending_approval')))
        .returning()
      if (!row) {
        throw new ApiError(
          409,
          'TRANSICAO_INVALIDA',
          'O estado do cliente mudou; recarregue e tente de novo',
        )
      }
      return toCustomer(row)
    },
  )
}
