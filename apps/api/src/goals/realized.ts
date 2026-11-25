import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import type { Database } from '../db/client'
import { customers, orderItems, routes, salesOrders, visits } from '../db/schema'
import { startOfDayInSaoPaulo } from '../time/calendar-date'

/** O realizado de um Vendedor no mês, nos três indicadores da Meta. */
export type Realized = {
  revenueCents: number
  visits: number
  newCustomers: number
}

export const NOTHING_REALIZED: Realized = { revenueCents: 0, visits: 0, newCustomers: 0 }

/** "2026-11" ou "2026-11-01" → primeiro dia do mês ("2026-11-01"). */
export function firstDayOfMonth(month: string): string {
  return `${month.slice(0, 7)}-01`
}

/** O mês civil ("2026-11") de uma data de calendário. */
export function monthOf(date: string): string {
  return date.slice(0, 7)
}

/** O mês anterior, em "AAAA-MM". */
export function previousMonth(month: string): string {
  const [year, number] = month.split('-').map(Number) as [number, number]
  const date = new Date(Date.UTC(year, number - 2, 1))
  return date.toISOString().slice(0, 7)
}

/** [início, fim) do mês no fuso America/Sao_Paulo. */
export function monthRange(month: string): { start: Date; end: Date } {
  const [year, number] = month.split('-').map(Number) as [number, number]
  const next = new Date(Date.UTC(year, number, 1)).toISOString().slice(0, 10)
  return { start: startOfDayInSaoPaulo(firstDayOfMonth(month)), end: startOfDayInSaoPaulo(next) }
}

/**
 * O realizado do mês, por Vendedor, calculado na leitura (RN02):
 * - faturamento: a soma dos itens dos Pedidos emitidos no mês (preço congelado);
 * - visitas: Visitas Concluídas (Venda Realizada ou Apenas Auditoria) com check-out no mês;
 * - novos clientes: Prospecções do Vendedor aprovadas no mês.
 * Vendedor sem nada no mês não aparece no mapa.
 */
export async function realizedByMonth(
  db: Database,
  month: string,
  sellerIds?: readonly string[],
): Promise<Map<string, Realized>> {
  const { start, end } = monthRange(month)
  const result = new Map<string, Realized>()
  const entry = (sellerId: string) => {
    let current = result.get(sellerId)
    if (!current) {
      current = { ...NOTHING_REALIZED }
      result.set(sellerId, current)
    }
    return current
  }
  const restrict = (column: typeof routes.sellerId | typeof customers.createdById) =>
    sellerIds ? inArray(column, [...sellerIds]) : undefined
  if (sellerIds?.length === 0) return result

  const revenue = await db
    .select({
      sellerId: routes.sellerId,
      total: sql<string>`sum(${orderItems.quantity} * ${orderItems.unitPriceCents})`,
    })
    .from(orderItems)
    .innerJoin(salesOrders, eq(orderItems.orderId, salesOrders.id))
    .innerJoin(visits, eq(salesOrders.visitId, visits.id))
    .innerJoin(routes, eq(visits.routeId, routes.id))
    .where(
      and(
        gte(salesOrders.occurredAt, start),
        lt(salesOrders.occurredAt, end),
        restrict(routes.sellerId),
      ),
    )
    .groupBy(routes.sellerId)
  for (const row of revenue) entry(row.sellerId).revenueCents = Number(row.total)

  const completed = await db
    .select({ sellerId: routes.sellerId, total: sql<number>`count(*)::int` })
    .from(visits)
    .innerJoin(routes, eq(visits.routeId, routes.id))
    .where(
      and(
        inArray(visits.outcome, ['sale_made', 'audit_only']),
        gte(visits.checkedOutAt, start),
        lt(visits.checkedOutAt, end),
        restrict(routes.sellerId),
      ),
    )
    .groupBy(routes.sellerId)
  for (const row of completed) entry(row.sellerId).visits = row.total

  const approved = await db
    .select({ sellerId: customers.createdById, total: sql<number>`count(*)::int` })
    .from(customers)
    .where(
      and(
        eq(customers.origin, 'prospect'),
        eq(customers.status, 'active'),
        gte(customers.approvedAt, start),
        lt(customers.approvedAt, end),
        restrict(customers.createdById),
      ),
    )
    .groupBy(customers.createdById)
  for (const row of approved) entry(row.sellerId).newCustomers = row.total

  return result
}
