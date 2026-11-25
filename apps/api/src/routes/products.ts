import { pageOf, problemaSchema, productFiltersSchema, productSchema } from '@axis/contracts'
import { and, asc, desc, eq, ilike, or } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { products } from '../db/schema'
import { toProduct } from '../orders/to-order'

const SORT_COLUMNS = {
  name: products.name,
  sku: products.sku,
  category: products.category,
  unitPriceCents: products.unitPriceCents,
  referenceStock: products.referenceStock,
  createdAt: products.createdAt,
} as const

/**
 * Catálogo, só leitura. O Vendedor, o Coordenador e o Diretor enxergam só os Produtos ativos; o
 * Administrador, dono do catálogo, vê todos e filtra por `active`.
 */
export async function productRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/v1/products',
    {
      onRequest: app.authenticate,
      schema: {
        tags: ['products'],
        summary: 'Lista os Produtos do catálogo',
        security: [{ bearerAuth: [] }],
        querystring: productFiltersSchema,
        response: {
          200: pageOf(productSchema),
          401: problemaSchema,
          403: problemaSchema,
          422: problemaSchema,
        },
      },
    },
    async (request) => {
      const { page, perPage, search, category, active, sortBy, order } = request.query
      const owner = request.user.role === 'administrator'
      const term = search ? `%${search.replace(/[%_\\]/g, '\\$&')}%` : undefined
      const where = and(
        owner
          ? active === undefined
            ? undefined
            : eq(products.active, active)
          : eq(products.active, true),
        category ? eq(products.category, category) : undefined,
        term ? or(ilike(products.name, term), ilike(products.sku, term)) : undefined,
      )
      const direction = order === 'desc' ? desc : asc
      const [total, rows] = await Promise.all([
        app.db.$count(products, where),
        app.db
          .select()
          .from(products)
          .where(where)
          .orderBy(direction(SORT_COLUMNS[sortBy]), asc(products.id))
          .limit(perPage)
          .offset((page - 1) * perPage),
      ])
      return { items: rows.map(toProduct), total, page, perPage }
    },
  )
}
