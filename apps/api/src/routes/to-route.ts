import { type Route, type RouteVisit, type Visit, visitStatusOf } from '@axis/contracts'
import { toCustomer } from '../customers/to-customer'
import type { customers, routes, visits } from '../db/schema'

export function toRoute(row: typeof routes.$inferSelect): Route {
  return {
    id: row.id,
    sellerId: row.sellerId,
    date: row.date,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toVisit(row: typeof visits.$inferSelect): Visit {
  return {
    id: row.id,
    routeId: row.routeId,
    customerId: row.customerId,
    position: row.position,
    checkedInAt: row.checkedInAt?.toISOString() ?? null,
    checkInLatitude: row.checkInLatitude,
    checkInLongitude: row.checkInLongitude,
    checkInAccuracyMeters: row.checkInAccuracyMeters,
    checkInDistanceMeters: row.checkInDistanceMeters,
    checkInStatus: row.checkInStatus,
    checkInJustification: row.checkInJustification,
    checkedOutAt: row.checkedOutAt?.toISOString() ?? null,
    outcome: row.outcome,
    outcomeJustification: row.outcomeJustification,
    summary: row.summary,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** A Visita com o estado derivado (um só helper, o do contrato) e o Cliente. */
export function toRouteVisit(
  visit: typeof visits.$inferSelect,
  customer: typeof customers.$inferSelect,
): RouteVisit {
  const mapped = toVisit(visit)
  return { ...mapped, status: visitStatusOf(mapped), customer: toCustomer(customer) }
}
