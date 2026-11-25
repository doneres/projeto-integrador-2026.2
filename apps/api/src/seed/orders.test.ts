import { orderSchema, pageOf, productSchema } from '@axis/contracts'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Harness, harness } from '../../test/support/demo-harness'
import { customers, orderItems, products, salesOrders, visits } from '../db/schema'
import { DEMO_PRODUCTS } from './orders'

const NOW = new Date('2026-11-20T15:00:00Z')

describe('seedOrders (Produtos e Pedidos do seed demo)', () => {
  let h: Harness

  beforeAll(async () => {
    h = await harness(NOW)
    await h.seed(NOW)
  })
  afterAll(() => h.finish())

  const allOrders = async () => {
    const response = await h.get('3001', '/v1/orders?perPage=100&page=1')
    expect(response.statusCode).toBe(200)
    return pageOf(orderSchema).parse(response.json())
  }

  it('cerca de 12 Produtos com SKU, preço e estoque de referência', async () => {
    const response = await h.get('4001', '/v1/products?perPage=100')
    const catalog = pageOf(productSchema).parse(response.json())
    expect(catalog.total).toBe(DEMO_PRODUCTS.length)
    expect(catalog.total).toBeGreaterThanOrEqual(10)
    for (const product of catalog.items) {
      expect(product.sku).toBeTruthy()
      expect(product.unitPriceCents).toBeGreaterThan(0)
      expect(product.referenceStock).toBeGreaterThan(0)
    }
  })

  it('um Pedido em cada Visita de venda realizada, com 1 a 4 itens', async () => {
    const sales = await h.db.$count(visits, eq(visits.outcome, 'sale_made'))
    const withOrder = await h.db.$count(salesOrders)
    expect(sales).toBeGreaterThan(0)
    // Só ficam sem Pedido as Visitas de Clientes que deixaram de ser ativos.
    expect(withOrder).toBeLessThanOrEqual(sales)
    expect(withOrder).toBeGreaterThan(0)

    const page = await allOrders()
    expect(page.total).toBe(withOrder)
    for (const order of page.items) {
      expect(order.items.length).toBeGreaterThanOrEqual(1)
      expect(order.items.length).toBeLessThanOrEqual(4)
    }
  })

  it('o preço do item é o congelado e o total é a soma dos itens', async () => {
    const page = await allOrders()
    const catalog = new Map(DEMO_PRODUCTS.map((p) => [p.sku, p]))
    const rows = await h.db.select().from(products)
    const skuOf = new Map(rows.map((row) => [row.id, row.sku]))

    for (const order of page.items) {
      let total = 0
      for (const item of order.items) {
        const product = catalog.get(skuOf.get(item.productId) as string)
        expect([product?.unitPriceCents, product?.previousPriceCents]).toContain(
          item.unitPriceCents,
        )
        total += item.quantity * item.unitPriceCents
      }
      expect(order.totalCents).toBe(total)
    }
  })

  it('pelo menos um Produto tem preço atual diferente do congelado em Pedidos antigos', async () => {
    const rows = await h.db
      .select({
        sku: products.sku,
        current: products.unitPriceCents,
        frozen: orderItems.unitPriceCents,
      })
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
    expect(rows.some((row) => row.current !== row.frozen)).toBe(true)
  })

  it('nenhum Pedido para Cliente Pendente de aprovação (RN04)', async () => {
    const pending = await h.db
      .select({ id: salesOrders.id })
      .from(salesOrders)
      .innerJoin(visits, eq(salesOrders.visitId, visits.id))
      .innerJoin(customers, eq(visits.customerId, customers.id))
      .where(eq(customers.status, 'pending_approval'))
    expect(pending).toHaveLength(0)
  })

  it('o Vendedor lê os Pedidos do próprio histórico, e só os dele', async () => {
    const response = await h.get('2001', '/v1/orders?perPage=100')
    const mine = pageOf(orderSchema).parse(response.json())
    expect(mine.total).toBeGreaterThan(0)
    const all = await allOrders()
    expect(mine.total).toBeLessThan(all.total)
  })

  it('rodar de novo não duplica nada', async () => {
    const before = await h.db.$count(salesOrders)
    const report = await h.seed(NOW)
    expect(report.ordersCreated).toBe(0)
    expect(report.productsCreated).toBe(0)
    expect(await h.db.$count(salesOrders)).toBe(before)
  })
})
