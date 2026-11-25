import {
  createRouteBodySchema,
  type ErroDeCampo,
  idSchema,
  pageOf,
  problemaSchema,
  routeDetailSchema,
  routeFiltersSchema,
  routeSchema,
} from '@axis/contracts'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { v7 as uuidv7 } from 'uuid'
import { z } from 'zod'
import { requireRole, routeScope } from '../access/scope'
import { isUniqueViolation } from '../db/errors'
import { customers, routes, users, visits } from '../db/schema'
import { ApiError } from '../errors'
import { calendarDateInSaoPaulo } from '../time/calendar-date'
import { toRoute, toRouteVisit } from './to-route'

/**
 * Rotas de trabalho. `/today` é a tela do dia do Vendedor; `/{id}` e a listagem servem à gestão,
 * sempre dentro do escopo do perfil (Vendedor: as suas; Coordenador: a Equipe; Diretor: todas).
 * O Coordenador monta a rota com o POST.
 */
export async function routeRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>()
  const security = [{ bearerAuth: [] }]

  /** A rota com as Visitas pela posição e o Cliente de cada uma. */
  async function detailOf(route: typeof routes.$inferSelect) {
    const rows = await app.db
      .select({ visit: visits, customer: customers })
      .from(visits)
      .innerJoin(customers, eq(visits.customerId, customers.id))
      .where(eq(visits.routeId, route.id))
      .orderBy(asc(visits.position), asc(visits.id))
    return { ...toRoute(route), visits: rows.map((r) => toRouteVisit(r.visit, r.customer)) }
  }

  typed.get(
    '/v1/routes/today',
    {
      onRequest: app.authenticate,
      schema: {
        tags: ['routes'],
        summary: 'Rota do dia do Vendedor (fuso America/Sao_Paulo)',
        description:
          'A rota de hoje do Vendedor autenticado, com as Visitas ordenadas pela posição, o estado derivado de cada uma e o Cliente. 404 SEM_ROTA_HOJE quando o Coordenador não montou rota para o dia.',
        security,
        response: {
          200: routeDetailSchema,
          401: problemaSchema,
          403: problemaSchema,
          404: problemaSchema,
        },
      },
    },
    async (request) => {
      requireRole(request.user, 'seller')
      const today = calendarDateInSaoPaulo(app.now())
      const [route] = await app.db
        .select()
        .from(routes)
        .where(and(eq(routes.sellerId, request.user.id), eq(routes.date, today)))
      if (!route) throw new ApiError(404, 'SEM_ROTA_HOJE', 'Não há rota montada para hoje')
      return detailOf(route)
    },
  )

  typed.get(
    '/v1/routes/:id',
    {
      onRequest: app.authenticate,
      schema: {
        tags: ['routes'],
        summary: 'Rota com as Visitas e os Clientes',
        description:
          'Fora do escopo do perfil a resposta é 404, igual à de uma rota que não existe.',
        security,
        params: z.object({ id: idSchema }),
        response: {
          200: routeDetailSchema,
          401: problemaSchema,
          403: problemaSchema,
          404: problemaSchema,
          422: problemaSchema,
        },
      },
    },
    async (request) => {
      const scope = routeScope(app.db, request.user)
      const [route] = await app.db
        .select()
        .from(routes)
        .where(and(eq(routes.id, request.params.id), scope))
      if (!route) throw new ApiError(404, 'NAO_ENCONTRADO', 'Rota não encontrada')
      return detailOf(route)
    },
  )

  typed.get(
    '/v1/routes',
    {
      onRequest: app.authenticate,
      schema: {
        tags: ['routes'],
        summary: 'Lista as rotas do escopo do perfil, da mais recente para a mais antiga',
        security,
        querystring: routeFiltersSchema,
        response: {
          200: pageOf(routeSchema),
          401: problemaSchema,
          403: problemaSchema,
          422: problemaSchema,
        },
      },
    },
    async (request) => {
      const { page, perPage, date, sellerId } = request.query
      const where = and(
        routeScope(app.db, request.user),
        date ? eq(routes.date, date) : undefined,
        sellerId ? eq(routes.sellerId, sellerId) : undefined,
      )
      const [total, rows] = await Promise.all([
        app.db.$count(routes, where),
        app.db
          .select()
          .from(routes)
          .where(where)
          .orderBy(desc(routes.date), desc(routes.id))
          .limit(perPage)
          .offset((page - 1) * perPage),
      ])
      return { items: rows.map(toRoute), total, page, perPage }
    },
  )

  typed.post(
    '/v1/routes',
    {
      onRequest: app.authenticate,
      schema: {
        tags: ['routes'],
        summary: 'Monta a rota de um Vendedor da Equipe para uma data',
        description:
          'Só o Coordenador. Cria a rota e uma Visita Pendente por Cliente, com a posição na ordem de `customerIds`. 409 ROTA_JA_EXISTE se o Vendedor já tem rota na data; 422 se o Vendedor ou algum Cliente não é da Equipe, ou se o Cliente não está ativo.',
        security,
        body: createRouteBodySchema,
        response: {
          201: routeDetailSchema,
          401: problemaSchema,
          403: problemaSchema,
          409: problemaSchema,
          422: problemaSchema,
        },
      },
    },
    async (request, reply) => {
      requireRole(request.user, 'coordinator')
      const { sellerId, date, customerIds } = request.body
      const coordinatorId = request.user.id

      const [seller] = await app.db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.id, sellerId),
            eq(users.role, 'seller'),
            eq(users.active, true),
            eq(users.coordinatorId, coordinatorId),
          ),
        )
      const found = await app.db
        .select({ id: customers.id })
        .from(customers)
        .where(
          and(
            inArray(customers.id, customerIds),
            eq(customers.coordinatorId, coordinatorId),
            eq(customers.status, 'active'),
          ),
        )

      const errors: ErroDeCampo[] = []
      if (!seller) {
        errors.push({ campo: 'sellerId', mensagem: 'O Vendedor não é ativo da sua Equipe' })
      }
      if (found.length !== customerIds.length) {
        errors.push({
          campo: 'customerIds',
          mensagem: 'Há Cliente que não é ativo da sua Equipe',
        })
      }
      if (errors.length > 0) {
        throw new ApiError(422, 'VALIDACAO', 'Dados inválidos', errors)
      }

      try {
        const route = await app.db.transaction(async (tx) => {
          const [created] = await tx
            .insert(routes)
            .values({ id: uuidv7(), sellerId, date, createdById: coordinatorId })
            .returning()
          await tx.insert(visits).values(
            customerIds.map((customerId, index) => ({
              id: uuidv7(),
              routeId: (created as typeof routes.$inferSelect).id,
              customerId,
              position: index + 1,
            })),
          )
          return created as typeof routes.$inferSelect
        })
        return reply.code(201).send(await detailOf(route))
      } catch (error) {
        if (isUniqueViolation(error, 'route_seller_date_unique')) {
          throw new ApiError(409, 'ROTA_JA_EXISTE', 'O Vendedor já tem rota nesta data')
        }
        throw error
      }
    },
  )
}
