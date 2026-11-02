import fastifySwagger from '@fastify/swagger'
import scalarReference from '@scalar/fastify-api-reference'
import Fastify, { type FastifyServerOptions } from 'fastify'
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod'
import { registerAuthentication } from './auth/authenticate'
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
  auth: {
    /** Segredo que assina os JWT (HS256). */
    jwtSecret: string
  }
  logger?: FastifyServerOptions['logger']
}

/** Monta a API sem abrir porta: o servidor (`server.ts`) escuta, os testes usam `app.inject()`. */
export async function buildApp({ db, auth, logger = false }: AppOptions) {
  const app = Fastify({ logger })

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

  await app.register(healthRoutes)
  await app.register(authRoutes, auth)
  await app.register(meRoutes)

  return app
}
