import { z } from 'zod'
import { centavosSchema, dataCalendarioSchema, idSchema } from './comum'

// Visão consolidada do painel (RF24, R9, #40): visitas planejadas × realizadas, faturamento do
// período e visitas por vendedor, sempre dentro do escopo do perfil (Coordenador: a sua Equipe;
// Diretor: todas as Equipes).

/** Query do GET /v1/dashboard: dia de referência no fuso America/Sao_Paulo. */
export const dashboardFiltersSchema = z.object({
  date: dataCalendarioSchema.optional(),
})
export type DashboardFilters = z.infer<typeof dashboardFiltersSchema>

/** Linha do gráfico de visitas por vendedor no dia consultado. */
export const dashboardSellerVisitsSchema = z.object({
  sellerId: idSchema,
  sellerName: z.string().trim().min(1),
  planned: z.number().int().min(0),
  completed: z.number().int().min(0),
  inProgress: z.number().int().min(0),
  notPerformed: z.number().int().min(0),
})
export type DashboardSellerVisits = z.infer<typeof dashboardSellerVisitsSchema>

/** Resposta do GET /v1/dashboard. */
export const dashboardSummarySchema = z.object({
  /** Dia consultado para as visitas (AAAA-MM-DD, America/Sao_Paulo). */
  date: dataCalendarioSchema,
  /** Mês civil do faturamento (AAAA-MM, derivado de `date`). */
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Use o formato AAAA-MM'),
  visits: z.object({
    planned: z.number().int().min(0),
    completed: z.number().int().min(0),
    inProgress: z.number().int().min(0),
    notPerformed: z.number().int().min(0),
    pending: z.number().int().min(0),
  }),
  /** Faturamento dos pedidos emitidos no mês civil (`month`), em centavos. */
  revenueCents: centavosSchema,
  /** Quantidade de pedidos emitidos no mês civil (`month`). */
  ordersCount: z.number().int().min(0),
  /** Visitas planejadas × realizadas por vendedor ativo do escopo, em ordem alfabética. */
  visitsBySeller: z.array(dashboardSellerVisitsSchema),
})
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>
