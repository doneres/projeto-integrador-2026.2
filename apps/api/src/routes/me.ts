import { problemaSchema, userSchema } from '@axis/contracts'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'

/**
 * GET /v1/me: o perfil de quem está logado. É a rota protegida de referência: as demais copiam o
 * `onRequest: app.authenticate` e leem o usuário e o perfil em `request.user`.
 */
export async function meRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/v1/me',
    {
      onRequest: app.authenticate,
      schema: {
        tags: ['auth'],
        summary: 'Perfil do usuário autenticado',
        security: [{ bearerAuth: [] }],
        response: { 200: userSchema, 401: problemaSchema },
      },
    },
    async (request) => request.user,
  )
}
