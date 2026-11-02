import { z } from 'zod'
import { dataCalendarioSchema, idSchema, instanteSchema } from './comum'

// Rota (Visitas de um Vendedor em um dia) conforme o modelo de dados (#26).

export const routeSchema = z.object({
  id: idSchema,
  sellerId: idSchema,
  /** Data de calendário no fuso America/Sao_Paulo. Única por vendedor. */
  date: dataCalendarioSchema,
  /** Coordenador que montou a rota. */
  createdById: idSchema,
  createdAt: instanteSchema,
  updatedAt: instanteSchema,
})
export type Route = z.infer<typeof routeSchema>

/**
 * Corpo do POST /v1/routes. A ordem de `customerIds` vira a `position` de cada Visita, que nasce
 * Pendente junto com a rota. O mesmo cliente não aparece duas vezes.
 */
export const createRouteBodySchema = z.object({
  sellerId: idSchema,
  date: dataCalendarioSchema,
  customerIds: z
    .array(idSchema)
    .min(1, 'Escolha ao menos um cliente')
    .max(100, 'Uma rota tem no máximo 100 clientes')
    .refine((ids) => new Set(ids).size === ids.length, 'Cada cliente entra uma vez na rota'),
})
export type CreateRouteBody = z.infer<typeof createRouteBodySchema>
