import { z } from 'zod'
import { centavosSchema, idSchema, instanteSchema } from './comum'
import { requiredText } from './fields'
import { paginationSchema } from './pagination'

// Modelo de Produto conforme ADR 0001 e modelo de dados (#26, RF20).

export const productSchema = z.object({
  id: idSchema,
  sku: z.string().trim().min(1, 'Informe o SKU do produto').max(50, 'Use no máximo 50 caracteres'),
  name: requiredText('o nome do produto', 150),
  category: requiredText('a categoria', 100),
  unitPriceCents: centavosSchema,
  referenceStock: z.number().int().min(0, 'O estoque não pode ser negativo'),
  imageUrl: z.string().trim().url('Informe uma URL válida').nullable(),
  active: z.boolean(),
  createdAt: instanteSchema,
  updatedAt: instanteSchema,
})
export type Product = z.infer<typeof productSchema>

/**
 * Corpo do POST /v1/products e do PUT /v1/products/{id}.
 * O Administrador cadastra ou atualiza um item no catálogo.
 */
export const productInputSchema = z.object({
  sku: z.string().trim().min(1, 'Informe o SKU do produto').max(50, 'Use no máximo 50 caracteres'),
  name: requiredText('o nome do produto', 150),
  category: requiredText('a categoria', 100),
  unitPriceCents: centavosSchema.refine((v) => v > 0, 'O preço deve ser maior que zero'),
  referenceStock: z.number().int().min(0, 'O estoque não pode ser negativo'),
  imageUrl: z.string().trim().url('Informe uma URL válida').nullable().optional(),
})
export type ProductInput = z.infer<typeof productInputSchema>

/** Corpo do PATCH /v1/products/{id}/status: inativa ou reativa um produto. */
export const productStatusChangeSchema = z.object({
  active: z.boolean(),
})
export type ProductStatusChange = z.infer<typeof productStatusChangeSchema>

export const productSortFieldSchema = z.enum([
  'name',
  'sku',
  'category',
  'unitPriceCents',
  'referenceStock',
  'createdAt',
])
export type ProductSortField = z.infer<typeof productSortFieldSchema>

/** Query do GET /v1/products: paginação, busca, filtros por categoria e status ativo/inativo. */
export const productFiltersSchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().max(100).optional(),
  active: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional(),
  sortBy: productSortFieldSchema.default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
})
export type ProductFilters = z.infer<typeof productFiltersSchema>
