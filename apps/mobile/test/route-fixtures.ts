import type { RouteDetail, RouteVisit, VisitStatus } from '@axis/contracts'

const SELLER_ID = '0198f2a0-7c1e-7000-8000-000000000001'
const COORDINATOR_ID = '0198f2a0-7c1e-7000-8000-000000000002'
const STAMP = '2026-11-06T11:00:00.000Z'

/** UUID de teste estável a partir de um número. */
function uuid(n: number): string {
  return `0198f2a0-7c1e-7000-8000-${String(n).padStart(12, '0')}`
}

/** Leitura do check-in feito no local, comum a todo estado depois de Pendente. */
const CHECKED_IN = {
  checkedInAt: '2026-11-06T12:00:00.000Z',
  checkInLatitude: -23.55,
  checkInLongitude: -46.63,
  checkInAccuracyMeters: 8,
  checkInDistanceMeters: 12,
  checkInStatus: 'on_site',
} satisfies Partial<RouteVisit>

const VISIT_FIELDS: Record<VisitStatus, Partial<RouteVisit>> = {
  pending: {},
  in_progress: {
    ...CHECKED_IN,
  },
  completed: {
    ...CHECKED_IN,
    checkedOutAt: '2026-11-06T12:30:00.000Z',
    outcome: 'sale_made',
  },
  not_performed: {
    ...CHECKED_IN,
    checkedOutAt: '2026-11-06T12:10:00.000Z',
    outcome: 'customer_closed',
    outcomeJustification: 'Estabelecimento fechado',
  },
}

/** Visita da rota (com Cliente) no estado pedido. `n` define ids e nome: "Cliente n". */
export function routeVisit(n: number, status: VisitStatus): RouteVisit {
  return {
    id: uuid(100 + n),
    routeId: uuid(10),
    customerId: uuid(200 + n),
    position: n,
    checkedInAt: null,
    checkInLatitude: null,
    checkInLongitude: null,
    checkInAccuracyMeters: null,
    checkInDistanceMeters: null,
    checkInStatus: null,
    checkInJustification: null,
    checkedOutAt: null,
    outcome: null,
    outcomeJustification: null,
    summary: null,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...VISIT_FIELDS[status],
    status,
    customer: {
      id: uuid(200 + n),
      legalName: `Razão Social ${n} Ltda`,
      tradeName: `Mercado ${n}`,
      document: '11222333000181',
      phone: '11987654321',
      contactName: 'Maria',
      zipCode: '01310100',
      street: `Rua das Flores`,
      number: String(n * 10),
      complement: null,
      district: 'Centro',
      city: 'São Paulo',
      state: 'SP',
      latitude: -23.55,
      longitude: -46.63,
      origin: 'portfolio',
      status: 'active',
      coordinatorId: COORDINATOR_ID,
      createdById: COORDINATOR_ID,
      approvedById: COORDINATOR_ID,
      approvedAt: STAMP,
      rejectionReason: null,
      createdAt: STAMP,
      updatedAt: STAMP,
    },
  }
}

/** Rota do dia com uma Visita por estado, na ordem dada (posição 1, 2, ...). */
export function routeWith(statuses: VisitStatus[]): RouteDetail {
  return {
    id: uuid(10),
    sellerId: SELLER_ID,
    date: '2026-11-06',
    createdById: COORDINATOR_ID,
    createdAt: STAMP,
    updatedAt: STAMP,
    visits: statuses.map((status, index) => routeVisit(index + 1, status)),
  }
}
