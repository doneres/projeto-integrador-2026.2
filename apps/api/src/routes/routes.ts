import {
  idSchema,
  pageOf,
  problemaSchema,
  routeDetailSchema,
  routeFiltersSchema,
  routeSchema,
} from '@axis/contracts'
import { and, asc, desc, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireRole, routeScope } from '../access/scope'
import { customers, routes, visits } from '../db/schema'
import { ApiError } from '../errors'
import { calendarDateInSaoPaulo } from '../time/calendar-date'
import { toRoute, toRouteVisit } from './to-route'

/**
 * Leitura de rotas. `/today` é a tela do dia do Vendedor; `/{id}` e a listagem servem à gestão,
 * sempre dentro do escopo do perfil (Vendedor: as suas; Coordenador: a Equipe; Diretor: todas).
 */
export async function routeReadingRoutes(app: FastifyInstance) {
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
}
