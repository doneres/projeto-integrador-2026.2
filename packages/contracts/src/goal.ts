import { z } from 'zod'
import { centavosSchema, idSchema, instanteSchema } from './comum'

// Metas e Score ponderado conforme ADR 0001 e modelo de dados (#26, RF18, RF23, RN02).
// Metas são mensais (primeiro dia do mês, AAAA-MM-01) e definidas exclusivamente pelo Diretor.

export const MES_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/
export const DIA_PRIMEIRO_REGEX = /^\d{4}-(0[1-9]|1[0-2])-01$/

/** Formato do mês civil: AAAA-MM */
export const mesCivilSchema = z
  .string()
  .trim()
  .regex(MES_REGEX, 'Informe o mês civil no formato AAAA-MM')

/** Primeiro dia do mês no fuso America/Sao_Paulo (AAAA-MM-01). */
export const primeiroDiaDoMesSchema = z
  .string()
  .trim()
  .regex(DIA_PRIMEIRO_REGEX, 'Informe a data do primeiro dia do mês no formato AAAA-MM-01')

/** Pesos dos indicadores na fórmula do score (RN02, parâmetros do sistema configuráveis pelo Administrador). */
export const DEFAULT_SCORE_WEIGHTS = {
  revenue: 50,
  visits: 30,
  newCustomers: 20,
} as const

export const scoreWeightsSchema = z
  .object({
    revenue: z.number().int().min(0).max(100),
    visits: z.number().int().min(0).max(100),
    newCustomers: z.number().int().min(0).max(100),
  })
  .refine(
    (w) => w.revenue + w.visits + w.newCustomers === 100,
    'A soma dos pesos deve ser exatamente 100%',
  )
export type ScoreWeights = z.infer<typeof scoreWeightsSchema>

/**
 * Meta mensal gravada no banco para um vendedor (tabela `goal`).
 * Valores nulos indicam "sem meta" naquele indicador específico.
 */
export const goalSchema = z.object({
  id: idSchema,
  sellerId: idSchema,
  month: primeiroDiaDoMesSchema,
  revenueTargetCents: centavosSchema.nullable(),
  visitsTarget: z.number().int().min(0).nullable(),
  newCustomersTarget: z.number().int().min(0).nullable(),
  setById: idSchema,
  createdAt: instanteSchema,
  updatedAt: instanteSchema,
})
export type Goal = z.infer<typeof goalSchema>

/**
 * Corpo do PUT /v1/goals/{sellerId}/{month}: Diretor cadastra ou edita a meta do vendedor.
 */
export const goalInputSchema = z.object({
  revenueTargetCents: centavosSchema.nullable().optional(),
  visitsTarget: z.number().int().min(0).nullable().optional(),
  newCustomersTarget: z.number().int().min(0).nullable().optional(),
})
export type GoalInput = z.infer<typeof goalInputSchema>

/** Query do GET /v1/goals: filtra por mês civil e opcionalmente por vendedor. */
export const goalFiltersSchema = z.object({
  month: mesCivilSchema.optional(),
  sellerId: idSchema.optional(),
})
export type GoalFilters = z.infer<typeof goalFiltersSchema>

/** Realizado de um indicador com meta, atingimento e teto de 100% da RN02. */
export const indicatorPerformanceSchema = z.object({
  target: z.number().nullable(),
  realized: z.number(),
  /** Percentual sem teto: (realized / target) * 100 */
  percent: z.number().nullable(),
  /** Percentual limitado a 100% (teto da RN02) */
  cappedPercent: z.number().nullable(),
  /** Peso do indicador no cálculo do score (0 a 100) */
  weight: z.number(),
})
export type IndicatorPerformance = z.infer<typeof indicatorPerformanceSchema>

/**
 * Desempenho e Score calculado na leitura (GET /v1/goals/summary ou GET /v1/goals):
 * Reúne a meta cadastrada, o realizado dos pedidos/visitas/prospecções e o score ponderado (RN02).
 */
export const sellerScoreSummarySchema = z.object({
  sellerId: idSchema,
  sellerName: z.string(),
  coordinatorId: idSchema.nullable(),
  coordinatorName: z.string().nullable(),
  month: mesCivilSchema,
  hasGoal: z.boolean(),
  revenue: indicatorPerformanceSchema,
  visits: indicatorPerformanceSchema,
  newCustomers: indicatorPerformanceSchema,
  /**
   * Score total calculado (0 a 100%).
   * Se nenhuma meta foi definida (ou todos os indicadores sem meta), score é null ("sem meta").
   */
  score: z.number().nullable(),
})
export type SellerScoreSummary = z.infer<typeof sellerScoreSummarySchema>

export const goalsMonthlyReportSchema = z.object({
  month: mesCivilSchema,
  weights: scoreWeightsSchema,
  sellers: z.array(sellerScoreSummarySchema),
  overallScore: z.number().nullable(),
})
export type GoalsMonthlyReport = z.infer<typeof goalsMonthlyReportSchema>

/**
 * Calcula o atingimento com teto de 100% conforme a RN02:
 * atingimento = min(realizado / meta, 1)
 */
export function calcularAtingimento(
  realizado: number,
  meta: number | null | undefined,
): { percent: number | null; cappedPercent: number | null } {
  if (meta === null || meta === undefined || meta <= 0) {
    return { percent: null, cappedPercent: null }
  }
  const proporcao = realizado / meta
  const percent = Math.round(proporcao * 100)
  const cappedPercent = Math.min(percent, 100)
  return { percent, cappedPercent }
}

/**
 * Calcula o Score ponderado da RN02:
 * Score = Σ (peso_i * min(realizado_i / meta_i, 1)) / Σ peso_i_com_meta
 * Se nenhum indicador possui meta, retorna null ("sem meta").
 */
export function calcularScoreRN02(
  indicadores: {
    revenue: { realized: number; target: number | null | undefined }
    visits: { realized: number; target: number | null | undefined }
    newCustomers: { realized: number; target: number | null | undefined }
  },
  pesos: ScoreWeights = DEFAULT_SCORE_WEIGHTS,
): {
  revenue: IndicatorPerformance
  visits: IndicatorPerformance
  newCustomers: IndicatorPerformance
  score: number | null
} {
  const rev = calcularAtingimento(indicadores.revenue.realized, indicadores.revenue.target)
  const vis = calcularAtingimento(indicadores.visits.realized, indicadores.visits.target)
  const cust = calcularAtingimento(
    indicadores.newCustomers.realized,
    indicadores.newCustomers.target,
  )

  const revenuePerf: IndicatorPerformance = {
    target: indicadores.revenue.target ?? null,
    realized: indicadores.revenue.realized,
    percent: rev.percent,
    cappedPercent: rev.cappedPercent,
    weight: pesos.revenue,
  }

  const visitsPerf: IndicatorPerformance = {
    target: indicadores.visits.target ?? null,
    realized: indicadores.visits.realized,
    percent: vis.percent,
    cappedPercent: vis.cappedPercent,
    weight: pesos.visits,
  }

  const newCustomersPerf: IndicatorPerformance = {
    target: indicadores.newCustomers.target ?? null,
    realized: indicadores.newCustomers.realized,
    percent: cust.percent,
    cappedPercent: cust.cappedPercent,
    weight: pesos.newCustomers,
  }

  let somaPesosComMeta = 0
  let somaScore = 0

  if (revenuePerf.cappedPercent !== null) {
    somaPesosComMeta += pesos.revenue
    somaScore += (pesos.revenue * revenuePerf.cappedPercent) / 100
  }
  if (visitsPerf.cappedPercent !== null) {
    somaPesosComMeta += pesos.visits
    somaScore += (pesos.visits * visitsPerf.cappedPercent) / 100
  }
  if (newCustomersPerf.cappedPercent !== null) {
    somaPesosComMeta += pesos.newCustomers
    somaScore += (pesos.newCustomers * newCustomersPerf.cappedPercent) / 100
  }

  const score =
    somaPesosComMeta > 0 ? Math.round((somaScore / (somaPesosComMeta / 100)) * 10) / 10 : null

  return {
    revenue: revenuePerf,
    visits: visitsPerf,
    newCustomers: newCustomersPerf,
    score,
  }
}
