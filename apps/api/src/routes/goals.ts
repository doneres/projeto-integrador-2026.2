import {
  calcularScoreRN02,
  type Goal,
  goalFiltersSchema,
  goalInputSchema,
  goalSchema,
  goalsMonthlyReportSchema,
  idSchema,
  mesCivilSchema,
  problemaSchema,
  type ScoreWeights,
  type SellerScoreSummary,
} from '@axis/contracts'
import { and, asc, eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { v7 as uuidv7 } from 'uuid'
import { z } from 'zod'
import { requireRole } from '../access/scope'
import { goals, systemSettings, users } from '../db/schema'
import { ApiError } from '../errors'
import { firstDayOfMonth, NOTHING_REALIZED, realizedByMonth } from '../goals/realized'
import { calendarDateInSaoPaulo } from '../time/calendar-date'

function toGoal(row: typeof goals.$inferSelect): Goal {
  return {
    id: row.id,
    sellerId: row.sellerId,
    month: row.month,
    revenueTargetCents: row.revenueTargetCents,
    visitsTarget: row.visitsTarget,
    newCustomersTarget: row.newCustomersTarget,
    setById: row.setById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * Metas e Score (RF18, RF23, RN02). O Diretor define a Meta; o realizado e o Score saem das
 * tabelas na leitura, com os pesos dos Parâmetros do sistema, e nada disso é gravado.
 */
export async function goalRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>()
  const security = [{ bearerAuth: [] }]

  typed.get(
    '/v1/goals',
    {
      onRequest: app.authenticate,
      schema: {
        tags: ['goals'],
        summary: 'Metas, realizado e Score do mês, por Vendedor',
        description:
          'Sem `month`, o mês corrente (America/Sao_Paulo). Vendedor: só ele. Coordenador: os Vendedores da Equipe. Diretor: todos. Só Vendedores ativos. Sem Meta, `hasGoal` é falso e o Score é nulo; indicador sem Meta fica fora do Score e os pesos dos demais são reaproveitados. O atingimento tem teto de 100 % por indicador.',
        security,
        querystring: goalFiltersSchema,
        response: {
          200: goalsMonthlyReportSchema,
          401: problemaSchema,
          403: problemaSchema,
          422: problemaSchema,
        },
      },
    },
    async (request) => {
      const { user } = request
      requireRole(user, 'seller', 'coordinator', 'director')
      const month = request.query.month ?? calendarDateInSaoPaulo(app.now()).slice(0, 7)

      const coordinator = alias(users, 'coordinator')
      const scope =
        user.role === 'seller'
          ? eq(users.id, user.id)
          : user.role === 'coordinator'
            ? eq(users.coordinatorId, user.id)
            : undefined
      const sellers = await app.db
        .select({ seller: users, coordinatorName: coordinator.name })
        .from(users)
        .leftJoin(coordinator, eq(users.coordinatorId, coordinator.id))
        .where(
          and(
            eq(users.role, 'seller'),
            eq(users.active, true),
            scope,
            request.query.sellerId ? eq(users.id, request.query.sellerId) : undefined,
          ),
        )
        .orderBy(asc(users.name), asc(users.id))

      const ids = sellers.map((row) => row.seller.id)
      const [settings] = await app.db.select().from(systemSettings)
      if (!settings) throw new ApiError(500, 'SEM_PARAMETROS', 'Parâmetros do sistema ausentes')
      const weights: ScoreWeights = {
        revenue: settings.scoreWeightRevenue,
        visits: settings.scoreWeightVisits,
        newCustomers: settings.scoreWeightNewCustomers,
      }
      const [realized, goalRows] = await Promise.all([
        realizedByMonth(app.db, month, ids),
        ids.length === 0
          ? []
          : app.db
              .select()
              .from(goals)
              .where(eq(goals.month, firstDayOfMonth(month))),
      ])
      const goalOf = new Map(goalRows.map((goal) => [goal.sellerId, goal]))

      const summaries: SellerScoreSummary[] = sellers.map(({ seller, coordinatorName }) => {
        const goal = goalOf.get(seller.id)
        const done = realized.get(seller.id) ?? NOTHING_REALIZED
        const performance = calcularScoreRN02(
          {
            revenue: { realized: done.revenueCents, target: goal?.revenueTargetCents },
            visits: { realized: done.visits, target: goal?.visitsTarget },
            newCustomers: { realized: done.newCustomers, target: goal?.newCustomersTarget },
          },
          weights,
        )
        return {
          sellerId: seller.id,
          sellerName: seller.name,
          coordinatorId: seller.coordinatorId,
          coordinatorName,
          month,
          hasGoal: goal !== undefined,
          ...performance,
        }
      })

      const scores = summaries.flatMap((s) => (s.score === null ? [] : [s.score]))
      const overallScore =
        scores.length === 0
          ? null
          : Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10
      return { month, weights, sellers: summaries, overallScore }
    },
  )

  typed.put(
    '/v1/goals/:sellerId/:month',
    {
      onRequest: app.authenticate,
      schema: {
        tags: ['goals'],
        summary: 'Define ou substitui a Meta de um Vendedor em um mês',
        description:
          'Só o Diretor. `null` ou ausente em um alvo = sem meta naquele indicador. 404 se o Vendedor não existe.',
        security,
        params: z.object({ sellerId: idSchema, month: mesCivilSchema }),
        body: goalInputSchema,
        response: {
          200: goalSchema,
          401: problemaSchema,
          403: problemaSchema,
          404: problemaSchema,
          422: problemaSchema,
        },
      },
    },
    async (request) => {
      requireRole(request.user, 'director')
      const { sellerId, month } = request.params
      const [seller] = await app.db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, sellerId), eq(users.role, 'seller')))
      if (!seller) throw new ApiError(404, 'NAO_ENCONTRADO', 'Vendedor não encontrado')

      const targets = {
        revenueTargetCents: request.body.revenueTargetCents ?? null,
        visitsTarget: request.body.visitsTarget ?? null,
        newCustomersTarget: request.body.newCustomersTarget ?? null,
      }
      const [row] = await app.db
        .insert(goals)
        .values({
          id: uuidv7(),
          sellerId,
          month: firstDayOfMonth(month),
          ...targets,
          setById: request.user.id,
        })
        .onConflictDoUpdate({
          target: [goals.sellerId, goals.month],
          set: { ...targets, setById: request.user.id },
        })
        .returning()
      return toGoal(row as typeof goals.$inferSelect)
    },
  )
}
