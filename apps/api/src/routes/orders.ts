import {
  createOrderBodySchema,
  orderFiltersSchema,
  orderSchema,
  pageOf,
  problemaSchema,
} from '@axis/contracts'
import { and, desc, eq, inArray } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { v7 as uuidv7 } from 'uuid'
import { requireRole, routeScope } from '../access/scope'
import { customers, orderItems, products, routes, salesOrders, visits } from '../db/schema'
import { ApiError } from '../errors'
import { toOrder } from '../orders/to-order'

/**
 * Pedidos. O Vendedor emite na Visita dele em andamento, com o preço do Produto copiado na hora
 * (congelado); a leitura respeita o escopo do perfil, como a das rotas.
 */
export async function orderRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>()
  const security = [{ bearerAuth: [] }]

  typed.post(
    '/v1/orders',
    {
      onRequest: app.authenticate,
      schema: {
        tags: ['orders'],
        summary: 'Emite um Pedido na Visita em andamento do Vendedor',
        description:
          'Só o Vendedor, na Visita dele. O preço de cada item é o do Produto agora e fica congelado. 409 VISITA_FORA_DE_ANDAMENTO sem check-in ou depois do check-out; 409 CLIENTE_NAO_ATIVO se o Cliente não está ativo (RN04); 422 para Produto inexistente ou inativo.',
        security,
        body: createOrderBodySchema,
        response: {
          201: orderSchema,
          401: problemaSchema,
          403: problemaSchema,
          404: problemaSchema,
          409: problemaSchema,
          422: problemaSchema,
        },
      },
    },
    async (request, reply) => {
      requireRole(request.user, 'seller')
      const { visitId, items } = request.body

      const [target] = await app.db
        .select({ visit: visits, customer: customers })
        .from(visits)
        .innerJoin(routes, eq(visits.routeId, routes.id))
        .innerJoin(customers, eq(visits.customerId, customers.id))
        .where(and(eq(visits.id, visitId), eq(routes.sellerId, request.user.id)))
      if (!target) throw new ApiError(404, 'NAO_ENCONTRADO', 'Visita não encontrada')
      if (!target.visit.checkedInAt || target.visit.checkedOutAt) {
        throw new ApiError(
          409,
          'VISITA_FORA_DE_ANDAMENTO',
          'O Pedido só é aceito com a Visita em andamento',
        )
      }
      if (target.customer.status !== 'active') {
        throw new ApiError(409, 'CLIENTE_NAO_ATIVO', 'O Cliente não está ativo')
      }

      const found = await app.db
        .select()
        .from(products)
        .where(
          and(
            inArray(
              products.id,
              items.map((item) => item.productId),
            ),
            eq(products.active, true),
          ),
        )
      if (found.length !== items.length) {
        throw new ApiError(422, 'PRODUTO_INDISPONIVEL', 'Há Produto inexistente ou inativo')
      }
      const priceOf = new Map(found.map((product) => [product.id, product.unitPriceCents]))

      const order = await app.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(salesOrders)
          .values({ id: uuidv7(), visitId, occurredAt: app.now() })
          .returning()
        const orderRow = created as typeof salesOrders.$inferSelect
        const rows = await tx
          .insert(orderItems)
          .values(
            items.map((item) => ({
              id: uuidv7(),
              orderId: orderRow.id,
              productId: item.productId,
              quantity: item.quantity,
              unitPriceCents: priceOf.get(item.productId) as number,
            })),
          )
          .returning()
        return toOrder(orderRow, rows)
      })
      return reply.code(201).send(order)
    },
  )

  typed.get(
    '/v1/orders',
    {
      onRequest: app.authenticate,
      schema: {
        tags: ['orders'],
        summary: 'Lista os Pedidos do escopo do perfil, do mais recente para o mais antigo',
        security,
        querystring: orderFiltersSchema,
        response: {
          200: pageOf(orderSchema),
          401: problemaSchema,
          403: problemaSchema,
          422: problemaSchema,
        },
      },
    },
    async (request) => {
      const { page, perPage, visitId } = request.query
      const scope = routeScope(app.db, request.user)
      const where = and(
        inArray(
          salesOrders.visitId,
          app.db
            .select({ id: visits.id })
            .from(visits)
            .innerJoin(routes, eq(visits.routeId, routes.id))
            .where(scope),
        ),
        visitId ? eq(salesOrders.visitId, visitId) : undefined,
      )
      const [total, rows] = await Promise.all([
        app.db.$count(salesOrders, where),
        app.db
          .select()
          .from(salesOrders)
          .where(where)
          .orderBy(desc(salesOrders.occurredAt), desc(salesOrders.id))
          .limit(perPage)
          .offset((page - 1) * perPage),
      ])
      const lines =
        rows.length === 0
          ? []
          : await app.db
              .select()
              .from(orderItems)
              .where(
                inArray(
                  orderItems.orderId,
                  rows.map((row) => row.id),
                ),
              )
      const items = rows.map((row) =>
        toOrder(
          row,
          lines.filter((line) => line.orderId === row.id),
        ),
      )
      return { items, total, page, perPage }
    },
  )
}
