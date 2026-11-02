import { loginBodySchema, problemaSchema, sessionSchema } from '@axis/contracts'
import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { type AuthOptions, DEFAULT_LOGIN_RATE_LIMIT } from '../auth/options'
import { verifyDecoyPassword, verifyPassword } from '../auth/password'
import { signToken } from '../auth/token'
import { users } from '../db/schema'
import { ApiError } from '../errors'
import { toUser } from '../users/to-user'

/** POST /v1/auth/login: e-mail ou matrícula e senha por um JWT de 8 h. Sem refresh nem autocadastro. */
export async function authRoutes(
  app: FastifyInstance,
  { jwtSecret, loginRateLimit = DEFAULT_LOGIN_RATE_LIMIT }: AuthOptions,
) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/v1/auth/login',
    {
      // Conta as tentativas por endereço, certas ou erradas: quem erra a senha em série trava.
      config: {
        rateLimit: {
          max: loginRateLimit.max,
          timeWindow: loginRateLimit.windowMs,
          errorResponseBuilder: () =>
            new ApiError(
              429,
              'MUITAS_TENTATIVAS',
              'Muitas tentativas de login. Tente de novo em instantes',
            ),
        },
      },
      schema: {
        tags: ['auth'],
        summary: 'Entra com e-mail ou matrícula e senha',
        body: loginBodySchema,
        response: {
          200: sessionSchema,
          401: problemaSchema,
          422: problemaSchema,
          429: problemaSchema,
        },
      },
    },
    async (request) => {
      const { identifier, password } = request.body
      // Com "@" é e-mail, sem "@" é matrícula (createUser proíbe "@" na matrícula): o identificador
      // nunca casa com duas contas.
      const lookup = identifier.includes('@')
        ? eq(users.email, identifier.toLowerCase())
        : eq(users.registration, identifier)
      const [row] = await app.db.select().from(users).where(lookup).limit(1)

      let passwordMatches = false
      if (row) passwordMatches = await verifyPassword(row.passwordHash, password)
      else await verifyDecoyPassword(password)
      // Um só erro para conta inexistente, senha errada e conta desativada: a resposta não revela
      // se o e-mail ou a matrícula existe.
      if (!row || !passwordMatches || !row.active) {
        throw new ApiError(401, 'CREDENCIAIS_INVALIDAS', 'E-mail, matrícula ou senha incorretos')
      }

      const { token, expiresAt } = await signToken(jwtSecret, row.id)
      return {
        token,
        expiresAt: expiresAt.toISOString(),
        user: toUser(row),
      }
    },
  )
}
