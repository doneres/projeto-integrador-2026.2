import type { CustomerOrigin, CustomerStatus, Outcome } from '@axis/contracts'
import { v7 as uuidv7 } from 'uuid'
import type { Database } from '../../src/db/client'
import { customers, routes, visits } from '../../src/db/schema'

let customerCounter = 0

/** Dígito verificador do CNPJ (módulo 11, pesos de 2 a 9 da direita para a esquerda). */
function cnpjDigit(digits: number[]): number {
  let sum = 0
  let weight = 2
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += (digits[i] as number) * weight
    weight = weight === 9 ? 2 : weight + 1
  }
  const rest = sum % 11
  return rest < 2 ? 0 : 11 - rest
}

/** CNPJ válido e distinto para cada n: a API valida o documento também na resposta. */
export function cnpjNumber(n: number): string {
  const base = [...String(n).padStart(12, '0')].map(Number)
  const first = cnpjDigit(base)
  const second = cnpjDigit([...base, first])
  return base.join('') + first + second
}

export type NewCustomerRow = {
  coordinatorId: string
  /** Padrão: o próprio coordenador. */
  createdById?: string
  tradeName?: string
  legalName?: string
  document?: string
  district?: string
  city?: string
  latitude?: number
  origin?: CustomerOrigin
  status?: CustomerStatus
  rejectionReason?: string
  createdAt?: Date
}

/** Insere um cliente direto no banco, com dados fictícios e um CNPJ válido e único. */
export async function insertCustomer(db: Database, input: NewCustomerRow) {
  customerCounter += 1
  const n = customerCounter
  const [row] = await db
    .insert(customers)
    .values({
      id: uuidv7(),
      legalName: input.legalName ?? `Comércio ${n} Ltda`,
      tradeName: input.tradeName ?? `Mercadinho ${n}`,
      document: input.document ?? cnpjNumber(n),
      phone: '62999990000',
      contactName: 'Maria (compras)',
      zipCode: '74000000',
      street: 'Rua Exemplo',
      number: '100',
      complement: null,
      district: input.district ?? 'Setor Central',
      city: input.city ?? 'Goiânia',
      state: 'GO',
      latitude: input.latitude ?? -16.6869,
      longitude: -49.2648,
      origin: input.origin ?? 'portfolio',
      status: input.status ?? 'active',
      coordinatorId: input.coordinatorId,
      createdById: input.createdById ?? input.coordinatorId,
      rejectionReason: input.rejectionReason ?? null,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    })
    .returning()
  if (!row) throw new Error('Falha ao criar o cliente de teste')
  return row
}

export type NewVisitRow = {
  customerId: string
  checkedInAt?: Date
  checkedOutAt?: Date
  outcome?: Outcome
  outcomeJustification?: string
}

/** Insere uma rota com as visitas na ordem recebida (position 1, 2, ...). */
export async function insertRoute(
  db: Database,
  input: { sellerId: string; createdById: string; date: string; visits: NewVisitRow[] },
) {
  const [route] = await db
    .insert(routes)
    .values({
      id: uuidv7(),
      sellerId: input.sellerId,
      date: input.date,
      createdById: input.createdById,
    })
    .returning()
  if (!route) throw new Error('Falha ao criar a rota de teste')

  const rows =
    input.visits.length === 0
      ? []
      : await db
          .insert(visits)
          .values(
            input.visits.map((visit, index) => ({
              id: uuidv7(),
              routeId: route.id,
              customerId: visit.customerId,
              position: index + 1,
              ...(visit.checkedInAt
                ? {
                    checkedInAt: visit.checkedInAt,
                    checkInLatitude: -16.6869,
                    checkInLongitude: -49.2648,
                    checkInAccuracyMeters: 10,
                    checkInDistanceMeters: 20,
                    checkInStatus: 'on_site' as const,
                  }
                : {}),
              ...(visit.checkedOutAt
                ? {
                    checkedOutAt: visit.checkedOutAt,
                    outcome: visit.outcome ?? 'sale_made',
                    outcomeJustification: visit.outcomeJustification ?? null,
                  }
                : {}),
            })),
          )
          .returning()
  return { route, visits: rows }
}
