import type { Prospect, SyncSnapshot } from '@axis/contracts'
import { routeVisit } from './route-fixtures'

const STAMP = '2026-11-06T11:00:00.000Z'

type ProspectState = Prospect['status']

/** Prospecção do Vendedor no estado pedido. `n` define id e nome: "Prospecção n". */
export function prospect(
  n: number,
  status: ProspectState,
  rejectionReason: string | null = null,
): Prospect {
  const base = routeVisit(n, 'pending').customer
  return {
    ...base,
    id: `0198f2a0-7c1e-7000-8000-${String(900 + n).padStart(12, '0')}`,
    tradeName: `Prospecção ${n}`,
    origin: 'prospect',
    status,
    createdById: '0198f2a0-7c1e-7000-8000-000000000001',
    approvedById: status === 'active' ? base.coordinatorId : null,
    approvedAt: status === 'active' ? STAMP : null,
    rejectionReason: status === 'rejected' ? (rejectionReason ?? 'Motivo da rejeição') : null,
  }
}

/** Snapshot sem rotas, só com as Prospecções dadas. */
export function snapshotWith(prospects: Prospect[]): SyncSnapshot {
  return { generatedAt: STAMP, checkinRadiusMeters: 100, routes: [], prospects }
}
