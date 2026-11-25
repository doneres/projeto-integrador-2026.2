import { type Order, orderTotalCents, type Product } from '@axis/contracts'
import type { orderItems, products, salesOrders } from '../db/schema'

export function toProduct(row: typeof products.$inferSelect): Product {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    unitPriceCents: row.unitPriceCents,
    referenceStock: row.referenceStock,
    imageUrl: row.imageUrl,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** O Pedido com os itens como foram emitidos e o total pela soma deles. */
export function toOrder(
  row: typeof salesOrders.$inferSelect,
  items: (typeof orderItems.$inferSelect)[],
): Order {
  const mapped = items
    .map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
    }))
    .sort((a, b) => a.productId.localeCompare(b.productId))
  return {
    id: row.id,
    visitId: row.visitId,
    items: mapped,
    totalCents: orderTotalCents(mapped),
    occurredAt: row.occurredAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }
}
