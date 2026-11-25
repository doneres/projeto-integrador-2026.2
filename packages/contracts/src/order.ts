import { z } from 'zod'
import { centavosSchema, idSchema, instanteSchema } from './comum'
import { paginationSchema } from './pagination'

// Pedido conforme o modelo de dados (#26, RF21). O total não é coluna: é a soma dos itens, com o
// preço copiado do Produto na emissão.

export const orderItemSchema = z.object({
  productId: idSchema,
  quantity: z.number().int().min(1, 'A quantidade mínima é 1').max(9999),
  /** Preço copiado do Produto na emissão; mudar o Produto depois não o altera. */
  unitPriceCents: centavosSchema,
})
export type OrderItem = z.infer<typeof orderItemSchema>

/** Total de um Pedido: a soma de `quantity * unitPriceCents` dos itens. */
export function orderTotalCents(items: Pick<OrderItem, 'quantity' | 'unitPriceCents'>[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0)
}

export const orderSchema = z.object({
  id: idSchema,
  visitId: idSchema,
  items: z.array(orderItemSchema).min(1),
  totalCents: centavosSchema,
  occurredAt: instanteSchema,
  createdAt: instanteSchema,
})
export type Order = z.infer<typeof orderSchema>

/**
 * Corpo do POST /v1/orders: só o Vendedor, na Visita dele em andamento e com o Cliente ativo
 * (RN04). O preço vem do Produto, nunca do corpo.
 */
export const createOrderBodySchema = z.object({
  visitId: idSchema,
  items: z
    .array(z.object({ productId: idSchema, quantity: orderItemSchema.shape.quantity }))
    .min(1, 'Inclua ao menos um item')
    .max(50, 'Um pedido tem no máximo 50 itens')
    .refine(
      (items) => new Set(items.map((item) => item.productId)).size === items.length,
      'Cada produto entra uma vez no pedido',
    ),
})
export type CreateOrderBody = z.infer<typeof createOrderBodySchema>

/** Query do GET /v1/orders. */
export const orderFiltersSchema = paginationSchema.extend({ visitId: idSchema.optional() })
export type OrderFilters = z.infer<typeof orderFiltersSchema>
