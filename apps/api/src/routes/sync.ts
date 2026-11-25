import { problemaSchema, syncSnapshotSchema } from '@axis/contracts'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { requireRole } from '../access/scope'
import { toCustomer } from '../customers/to-customer'
import { customers, routes, systemSettings, visits } from '../db/schema'
import { ApiError } from '../errors'
import { addCalendarDays, calendarDateInSaoPaulo } from '../time/calendar-date'
import { toRoute, toRouteVisit } from './to-route'

/**
 * Snapshot de sync do app do Vendedor (#27): tudo de que ele precisa para trabalhar offline, num
 * só pedido e sempre completo. Só dados do próprio Vendedor.
 */
export async function syncRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>()

  typed.get(
    '/v1/sync/snapshot',
    {
      onRequest: app.authenticate,
      schema: {
        tags: ['sync'],
        summary: 'Snapshot do Vendedor: rotas de hoje e amanhã, raio e Prospecções',
        description:
          'Rotas de hoje e de amanhã (fuso America/Sao_Paulo) com as Visitas e os Clientes, o raio do Check-in e as Prospecções que o próprio Vendedor cadastrou, com o estado e o motivo da rejeição. Dia sem rota não é erro: a lista vem sem ele. Comodatos e Produtos entram quando existirem.',
        security: [{ bearerAuth: [] }],
        response: {
          200: syncSnapshotSchema,
          401: problemaSchema,
          403: problemaSchema,
        },
      },
    },
    async (request) => {
      requireRole(request.user, 'seller')
      const sellerId = request.user.id
      const now = app.now()
      const today = calendarDateInSaoPaulo(now)
      const days = [today, addCalendarDays(today, 1)]

      const [settings] = await app.db.select().from(systemSettings)
      // O seed cria a linha única; sem ela o ambiente está mal preparado, e não o pedido.
      if (!settings) throw new ApiError(500, 'ERRO_INTERNO', 'Parâmetros do sistema ausentes')

      const [routeRows, prospectRows] = await Promise.all([
        app.db
          .select()
          .from(routes)
          .where(and(eq(routes.sellerId, sellerId), inArray(routes.date, days)))
          .orderBy(asc(routes.date)),
        app.db
          .select()
          .from(customers)
          .where(and(eq(customers.createdById, sellerId), eq(customers.origin, 'prospect')))
          .orderBy(desc(customers.createdAt), desc(customers.id)),
      ])

      const visitRows = routeRows.length
        ? await app.db
            .select({ visit: visits, customer: customers })
            .from(visits)
            .innerJoin(customers, eq(visits.customerId, customers.id))
            .where(
              inArray(
                visits.routeId,
                routeRows.map((route) => route.id),
              ),
            )
            .orderBy(asc(visits.position), asc(visits.id))
        : []

      return {
        generatedAt: now.toISOString(),
        checkinRadiusMeters: settings.checkinRadiusMeters,
        routes: routeRows.map((route) => ({
          ...toRoute(route),
          visits: visitRows
            .filter((row) => row.visit.routeId === route.id)
            .map((row) => toRouteVisit(row.visit, row.customer)),
        })),
        prospects: prospectRows.map(toCustomer),
      }
    },
  )
}
