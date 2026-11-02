import type { User } from '@axis/contracts'
import { eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { users } from '../db/schema'
import { ApiError } from '../errors'
import { toUser } from '../users/to-user'
import { verifyToken } from './token'

declare module 'fastify' {
  interface FastifyInstance {
    /**
     * Hook `onRequest` das rotas protegidas: exige token válido e conta ativa e preenche
     * `request.user`. Tem de ser `onRequest` (e não `preHandler`) para rodar antes da validação
     * do corpo: quem não está logado recebe 401, nunca 422.
     */
    authenticate: (request: FastifyRequest) => Promise<void>
  }
  interface FastifyRequest {
    user: User
  }
}

const notAuthenticated = () =>
  new ApiError(401, 'NAO_AUTENTICADO', 'Faça login para acessar este recurso')

export function registerAuthentication(app: FastifyInstance, { jwtSecret }: { jwtSecret: string }) {
  app.decorateRequest('user')

  app.decorate('authenticate', async (request: FastifyRequest) => {
    const [scheme, token] = request.headers.authorization?.split(' ') ?? []
    if (scheme?.toLowerCase() !== 'bearer' || !token) throw notAuthenticated()

    const userId = await verifyToken(jwtSecret, token)
    if (!userId) throw notAuthenticated()

    // A conta é conferida a cada requisição: desativar vale na hora, mesmo com o token válido.
    const [row] = await app.db.select().from(users).where(eq(users.id, userId))
    if (!row?.active) throw notAuthenticated()

    request.user = toUser(row)
  })
}
