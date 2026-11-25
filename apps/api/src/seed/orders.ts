import { and, asc, eq, inArray, notExists } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import type { Database } from '../db/client'
import { customers, orderItems, products, routes, salesOrders, visits } from '../db/schema'
import {
  addCalendarDays,
  calendarDateInSaoPaulo,
  startOfDayInSaoPaulo,
} from '../time/calendar-date'
import { randomFrom, SEED } from './demo-data'

// Catálogo e Pedidos da camada demo (#68). O catálogo é fixo; os Pedidos saem das Visitas com
// Desfecho Venda Realizada, com o preço do Produto na data da emissão.

export type DemoProduct = {
  sku: string
  name: string
  category: string
  /** Preço atual, em centavos. */
  unitPriceCents: number
  /** Preço antes do reajuste; só os Produtos reajustados têm. */
  previousPriceCents?: number
  referenceStock: number
}

/** Cerca de 12 Produtos; os três primeiros foram reajustados há `PRICE_CHANGE_DAYS_AGO` dias. */
export const DEMO_PRODUCTS: readonly DemoProduct[] = [
  {
    sku: 'BEB-001',
    name: 'Refrigerante Cola 2 L',
    category: 'Bebidas',
    unitPriceCents: 949,
    previousPriceCents: 899,
    referenceStock: 480,
  },
  {
    sku: 'BEB-002',
    name: 'Água Mineral 500 ml',
    category: 'Bebidas',
    unitPriceCents: 249,
    previousPriceCents: 229,
    referenceStock: 1200,
  },
  {
    sku: 'BEB-003',
    name: 'Suco de Laranja 1 L',
    category: 'Bebidas',
    unitPriceCents: 799,
    referenceStock: 320,
  },
  {
    sku: 'BEB-004',
    name: 'Energético Lata 269 ml',
    category: 'Bebidas',
    unitPriceCents: 699,
    previousPriceCents: 649,
    referenceStock: 260,
  },
  {
    sku: 'SNK-001',
    name: 'Salgadinho de Milho 120 g',
    category: 'Snacks',
    unitPriceCents: 599,
    referenceStock: 540,
  },
  {
    sku: 'SNK-002',
    name: 'Biscoito Recheado 130 g',
    category: 'Snacks',
    unitPriceCents: 399,
    referenceStock: 700,
  },
  {
    sku: 'SNK-003',
    name: 'Barra de Cereal 25 g',
    category: 'Snacks',
    unitPriceCents: 199,
    referenceStock: 900,
  },
  {
    sku: 'LAT-001',
    name: 'Leite Integral 1 L',
    category: 'Laticínios',
    unitPriceCents: 649,
    referenceStock: 600,
  },
  {
    sku: 'LAT-002',
    name: 'Iogurte Natural 170 g',
    category: 'Laticínios',
    unitPriceCents: 349,
    referenceStock: 380,
  },
  {
    sku: 'MER-001',
    name: 'Café Torrado 500 g',
    category: 'Mercearia',
    unitPriceCents: 1899,
    referenceStock: 210,
  },
  {
    sku: 'MER-002',
    name: 'Achocolatado em Pó 400 g',
    category: 'Mercearia',
    unitPriceCents: 1099,
    referenceStock: 290,
  },
  {
    sku: 'LIM-001',
    name: 'Detergente Neutro 500 ml',
    category: 'Limpeza',
    unitPriceCents: 249,
    referenceStock: 650,
  },
]

/** O reajuste dos Produtos que têm `previousPriceCents` aconteceu há tantos dias. */
const PRICE_CHANGE_DAYS_AGO = 10
/** Um Pedido tem de 1 a 4 itens, de 1 a 12 unidades cada. */
const ITEMS_PER_ORDER = [1, 4] as const
const QUANTITY = [1, 12] as const
const MINUTE_MS = 60 * 1000
/** Limite folgado para os parâmetros de um INSERT no Postgres (65 535). */
const ROWS_PER_INSERT = 1000

/** Preço de um Produto do catálogo no instante: o anterior, se o reajuste ainda não tinha ocorrido. */
export function priceAt(product: DemoProduct, instant: Date, now: Date): number {
  if (product.previousPriceCents === undefined) return product.unitPriceCents
  const changedAt = startOfDayInSaoPaulo(
    addCalendarDays(calendarDateInSaoPaulo(now), -PRICE_CHANGE_DAYS_AGO),
  )
  return instant < changedAt ? product.previousPriceCents : product.unitPriceCents
}

const between = (random: () => number, [min, max]: readonly [number, number]) =>
  min + Math.floor(random() * (max - min + 1))

/**
 * Cria o catálogo (pelo SKU, sem tocar no que já existe) e um Pedido em cada Visita Concluída com
 * Venda Realizada que ainda não tem um. Só entram Clientes ativos (RN04). Rodar de novo só
 * acrescenta o que falta.
 */
export async function seedOrders(db: Database, now: Date) {
  const inserted = await db
    .insert(products)
    .values(
      DEMO_PRODUCTS.map(({ previousPriceCents: _previous, ...product }) => ({
        ...product,
        id: uuidv7(),
        imageUrl: null,
      })),
    )
    .onConflictDoNothing({ target: products.sku })
    .returning({ id: products.id })

  const catalog = await db
    .select()
    .from(products)
    .where(
      inArray(
        products.sku,
        DEMO_PRODUCTS.map((product) => product.sku),
      ),
    )
  const productBySku = new Map(catalog.map((row) => [row.sku, row]))

  const pending = await db
    .select({ visit: visits })
    .from(visits)
    .innerJoin(routes, eq(visits.routeId, routes.id))
    .innerJoin(customers, eq(visits.customerId, customers.id))
    .where(
      and(
        eq(visits.outcome, 'sale_made'),
        eq(customers.status, 'active'),
        notExists(db.select().from(salesOrders).where(eq(salesOrders.visitId, visits.id))),
      ),
    )
    .orderBy(asc(routes.date), asc(routes.sellerId), asc(visits.position))

  const orderRows: (typeof salesOrders.$inferInsert)[] = []
  const itemRows: (typeof orderItems.$inferInsert)[] = []
  for (const [index, { visit }] of pending.entries()) {
    if (!visit.checkedInAt || !visit.checkedOutAt) continue
    const random = randomFrom(SEED + index)
    // Entre o Check-in e o Check-out: o Pedido só é aceito com a Visita em andamento.
    const occurredAt = new Date(
      Math.max(visit.checkedInAt.getTime(), visit.checkedOutAt.getTime() - 5 * MINUTE_MS),
    )

    const chosen = new Set<DemoProduct>()
    const wanted = between(random, ITEMS_PER_ORDER)
    while (chosen.size < wanted) {
      chosen.add(DEMO_PRODUCTS[Math.floor(random() * DEMO_PRODUCTS.length)] as DemoProduct)
    }

    const orderId = uuidv7()
    orderRows.push({ id: orderId, visitId: visit.id, occurredAt })
    for (const product of chosen) {
      itemRows.push({
        id: uuidv7(),
        orderId,
        productId: (productBySku.get(product.sku) as typeof products.$inferSelect).id,
        quantity: between(random, QUANTITY),
        unitPriceCents: priceAt(product, occurredAt, now),
      })
    }
  }

  if (orderRows.length > 0) {
    await db.transaction(async (tx) => {
      for (let start = 0; start < orderRows.length; start += ROWS_PER_INSERT) {
        await tx.insert(salesOrders).values(orderRows.slice(start, start + ROWS_PER_INSERT))
      }
      for (let start = 0; start < itemRows.length; start += ROWS_PER_INSERT) {
        await tx.insert(orderItems).values(itemRows.slice(start, start + ROWS_PER_INSERT))
      }
    })
  }
  const ordersCreated = orderRows.length

  return { productsCreated: inserted.length, ordersCreated }
}
