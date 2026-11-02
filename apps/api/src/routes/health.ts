import { healthSchema } from '@axis/contracts'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'

/**
 * GET /health: o ping externo que mantém o Render acordado bate aqui. Não toca o banco, senão o
 * Neon nunca suspende e estoura as CU-horas do plano gratuito (decisão da issue #28).
 */
export async function healthRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/health',
    {
      schema: {
        tags: ['health'],
        summary: 'API health',
        response: { 200: healthSchema },
      },
    },
    async () => ({ status: 'ok' as const }),
  )
}
