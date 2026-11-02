import { z } from 'zod'
import { dataCalendarioSchema, idSchema, instanteSchema } from './comum'
import { customerSchema } from './customer'
import { paginationSchema } from './pagination'
import { visitSchema, visitStatusSchema } from './visit'

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

/**
 * Visita como a rota a entrega: os campos da Visita, o estado derivado (`visitStatusOf`) e o
 * Cliente. O app não precisa de uma segunda chamada para montar a tela do dia.
 */
export const routeVisitSchema = z.intersection(
  visitSchema,
  z.object({ status: visitStatusSchema, customer: customerSchema }),
)
export type RouteVisit = z.infer<typeof routeVisitSchema>

/** Resposta do GET /v1/routes/today e do GET /v1/routes/{id}: a rota com as Visitas pela posição. */
export const routeDetailSchema = routeSchema.extend({ visits: z.array(routeVisitSchema) })
export type RouteDetail = z.infer<typeof routeDetailSchema>

/** Query do GET /v1/routes: paginação e filtros por dia e por vendedor. */
export const routeFiltersSchema = paginationSchema.extend({
  date: dataCalendarioSchema.optional(),
  sellerId: idSchema.optional(),
})
export type RouteFilters = z.infer<typeof routeFiltersSchema>
