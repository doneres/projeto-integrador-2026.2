import fastifyRateLimit from '@fastify/rate-limit'
import fastifySwagger from '@fastify/swagger'
import scalarReference from '@scalar/fastify-api-reference'
import Fastify, { type FastifyServerOptions } from 'fastify'
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod'
import { registerAuthentication } from './auth/authenticate'
import type { AuthOptions } from './auth/options'
import type { Database } from './db/client'
import { registerErrorHandling } from './errors'
import { authRoutes } from './routes/auth'
import { healthRoutes } from './routes/health'
import { meRoutes } from './routes/me'

declare module 'fastify' {
  interface FastifyInstance {
    db: Database
  }
}

export type AppOptions = {
  db: Database
  auth: AuthOptions
  /** Quantos proxies confiar (Render: 1; 0 = nenhum). O endereço do cliente vem do X-Forwarded-For. */
  trustProxy?: number
  logger?: FastifyServerOptions['logger']
}

/** Monta a API sem abrir porta: o servidor (`server.ts`) escuta, os testes usam `app.inject()`. */
export async function buildApp({ db, auth, logger = false, trustProxy = 0 }: AppOptions) {
  // Confia nos `trustProxy` saltos mais próximos; o cliente é o endereço logo depois deles.
  const app = Fastify({
    logger,
    trustProxy: trustProxy > 0 ? (_address, hop) => hop < trustProxy : false,
  })

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  registerErrorHandling(app)
  app.decorate('db', db)
  registerAuthentication(app, auth)

  // A documentação sai dos mesmos schemas Zod de @axis/contracts que validam as rotas.
  await app.register(fastifySwagger, {
    openapi: {
      info: { title: 'AXIS API', version: '0.0.0' },
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      },
    },
    transform: jsonSchemaTransform,
  })
  await app.register(scalarReference, { routePrefix: '/docs' })

  // Sem limite global: só as rotas que declaram `config.rateLimit` (o login) são limitadas.
  await app.register(fastifyRateLimit, { global: false })

  await app.register(healthRoutes)
  await app.register(authRoutes, auth)
  await app.register(meRoutes)

  return app
}
