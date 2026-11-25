import { z } from 'zod'
import { dataCalendarioSchema, idSchema, instanteSchema } from './comum'
import { customerSchema } from './customer'
import { requiredText } from './fields'
import { paginationSchema } from './pagination'

// Modelo de Materiais de PDV e Comodato conforme ADR 0001 e modelo de dados (#26, RF16, RF17).

/** Material de Ponto de Venda do catálogo (geladeira, freezer, banner, display, totem...). */
export const posMaterialSchema = z.object({
  id: idSchema,
  name: requiredText('o nome do material', 150),
  category: requiredText('a categoria', 100),
  active: z.boolean(),
  createdAt: instanteSchema,
  updatedAt: instanteSchema,
})
export type PosMaterial = z.infer<typeof posMaterialSchema>

/**
 * Corpo do POST /v1/pos-materials e do PUT /v1/pos-materials/{id}.
 * O Administrador cadastra ou edita um tipo de material no catálogo.
 */
export const posMaterialInputSchema = z.object({
  name: requiredText('o nome do material', 150),
  category: requiredText('a categoria', 100),
})
export type PosMaterialInput = z.infer<typeof posMaterialInputSchema>

/** Corpo do PATCH /v1/pos-materials/{id}/status: inativa ou reativa um material. */
export const posMaterialStatusChangeSchema = z.object({
  active: z.boolean(),
})
export type PosMaterialStatusChange = z.infer<typeof posMaterialStatusChangeSchema>

export const posMaterialSortFieldSchema = z.enum(['name', 'category', 'createdAt'])
export type PosMaterialSortField = z.infer<typeof posMaterialSortFieldSchema>

/** Query do GET /v1/pos-materials: paginação, busca e filtros por status e categoria. */
export const posMaterialFiltersSchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().max(100).optional(),
  active: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional(),
  sortBy: posMaterialSortFieldSchema.default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
})
export type PosMaterialFilters = z.infer<typeof posMaterialFiltersSchema>

/**
 * Comodato: vínculo de um material de PDV com um cliente, identificado por patrimônio ou número de série.
 * Exclusão física não existe: o encerramento preenche `endedAt`, preservando o histórico para auditoria.
 */
export const loanSchema = z.object({
  id: idSchema,
  materialId: idSchema,
  customerId: idSchema,
  serialNumber: z
    .string()
    .trim()
    .min(1, 'Informe o patrimônio ou número de série')
    .max(100, 'Use no máximo 100 caracteres'),
  installedAt: dataCalendarioSchema,
  endedAt: dataCalendarioSchema.nullable(),
  createdAt: instanteSchema,
  updatedAt: instanteSchema,
})
export type Loan = z.infer<typeof loanSchema>

/** Corpo do POST /v1/loans: Administrador registra novo comodato para um cliente. */
export const loanInputSchema = z.object({
  materialId: idSchema,
  customerId: idSchema,
  serialNumber: z
    .string()
    .trim()
    .min(1, 'Informe o patrimônio ou número de série')
    .max(100, 'Use no máximo 100 caracteres'),
  installedAt: dataCalendarioSchema,
})
export type LoanInput = z.infer<typeof loanInputSchema>

/** Corpo do PATCH /v1/loans/{id}/end: encerra o comodato informando a data de encerramento. */
export const loanEndSchema = z.object({
  endedAt: dataCalendarioSchema,
})
export type LoanEnd = z.infer<typeof loanEndSchema>

/**
 * Comodato enriquecido com dados do material e do cliente para exibição na interface web/app.
 */
export const loanDetailSchema = loanSchema.extend({
  material: posMaterialSchema.optional(),
  customer: customerSchema.optional(),
})
export type LoanDetail = z.infer<typeof loanDetailSchema>

export const loanSortFieldSchema = z.enum(['installedAt', 'serialNumber', 'createdAt'])
export type LoanSortField = z.infer<typeof loanSortFieldSchema>

/** Query do GET /v1/loans: filtros por cliente, material, somente ativos e busca textual. */
export const loanFiltersSchema = paginationSchema.extend({
  customerId: idSchema.optional(),
  materialId: idSchema.optional(),
  activeOnly: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional(),
  search: z.string().trim().max(100).optional(),
  sortBy: loanSortFieldSchema.default('installedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
})
export type LoanFilters = z.infer<typeof loanFiltersSchema>

/** Helper para verificar se um comodato está ativo (sem data de encerramento). */
export function isLoanActive(loan: { endedAt: string | null }): boolean {
  return loan.endedAt === null
}
