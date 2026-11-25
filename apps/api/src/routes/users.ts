import { pageOf, problemaSchema, userFiltersSchema, userSchema } from '@axis/contracts'
import { and, asc, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { userScope } from '../access/scope'
import { users } from '../db/schema'
import { toUser } from '../users/to-user'

/** Listagem de usuários para a gestão. O painel usa `role=seller` para escolher o Vendedor da rota. */
export async function userRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/v1/users',
    {
      onRequest: app.authenticate,
      schema: {
        tags: ['users'],
        summary: 'Lista os usuários ativos do escopo do perfil, por nome',
        description:
          'Coordenador: a sua Equipe (ele e os Vendedores dele). Diretor: todos. Só contas ativas. 403 para Vendedor e Administrador.',
        security: [{ bearerAuth: [] }],
        querystring: userFiltersSchema,
        response: {
          200: pageOf(userSchema),
          401: problemaSchema,
          403: problemaSchema,
          422: problemaSchema,
        },
      },
    },
    async (request) => {
      const { page, perPage, role } = request.query
      const where = and(
        userScope(request.user),
        eq(users.active, true),
        role ? eq(users.role, role) : undefined,
      )
      const [total, rows] = await Promise.all([
        app.db.$count(users, where),
        app.db
          .select()
          .from(users)
          .where(where)
          .orderBy(asc(users.name), asc(users.id))
          .limit(perPage)
          .offset((page - 1) * perPage),
      ])
      return { items: rows.map(toUser), total, page, perPage }
    },
  )
}
