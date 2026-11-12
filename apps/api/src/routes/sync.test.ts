import { type Problema, type SyncSnapshot, syncSnapshotSchema } from '@axis/contracts'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TEST_JWT_SECRET } from '../../test/support/config'
import { createTestDatabase, type TestDatabase } from '../../test/support/database'
import { insertCustomer, insertRoute } from '../../test/support/factories'
import { bearer, createWorld } from '../../test/support/world'
import { buildApp } from '../app'
import { systemSettings } from '../db/schema'

const TODAY = new Date('2026-11-03T15:00:00Z') // 12h em Brasília, terça 03/11/2026
let clock = TODAY

let testDb: TestDatabase
let app: Awaited<ReturnType<typeof buildApp>>
let world: Awaited<ReturnType<typeof createWorld>>

type ProspectState = 'pending_approval' | 'active' | 'rejected'

beforeAll(async () => {
  testDb = await createTestDatabase()
  app = await buildApp({
    db: testDb.db,
    auth: { jwtSecret: TEST_JWT_SECRET },
    now: () => clock,
  })
  world = await createWorld(testDb.db)
  await testDb.db.insert(systemSettings).values({
    checkinRadiusMeters: 150,
    scoreWeightRevenue: 50,
    scoreWeightVisits: 30,
    scoreWeightNewCustomers: 20,
  })

  const coordinatorA = world.coordinatorA.id
  const customer = (tradeName: string, coordinatorId = coordinatorA) =>
    insertCustomer(testDb.db, { coordinatorId, tradeName })
  const [padaria, mercado, kiosk, bar] = await Promise.all([
    customer('Padaria Central'),
    customer('Mercado Sul'),
    customer('Kiosk'),
    customer('Bar da Equipe B', world.coordinatorB.id),
  ])
  if (!padaria || !mercado || !kiosk || !bar) throw new Error('clientes de teste')

  // Vendedor A1: ontem, hoje, amanhã e depois de amanhã (só hoje e amanhã entram no snapshot).
  const route = (date: string, customerIds: string[], sellerId = world.sellerA1.id) =>
    insertRoute(testDb.db, {
      sellerId,
      createdById: coordinatorA,
      date,
      visits: customerIds.map((customerId) => ({ customerId })),
    })
  await route('2026-11-02', [kiosk.id])
  await route('2026-11-03', [padaria.id, mercado.id])
  await route('2026-11-04', [kiosk.id])
  await route('2026-11-05', [kiosk.id])
  // Rotas de outros Vendedores, de hoje.
  await route('2026-11-03', [padaria.id], world.sellerA2.id)
  await insertRoute(testDb.db, {
    sellerId: world.sellerB1.id,
    createdById: world.coordinatorB.id,
    date: '2026-11-03',
    visits: [{ customerId: bar.id }],
  })

  // Prospecções: três do A1 (uma de cada estado), uma do A2 e uma do B1.
  const prospect = (
    createdById: string,
    coordinatorId: string,
    tradeName: string,
    status: ProspectState,
    rejectionReason?: string,
  ) =>
    insertCustomer(testDb.db, {
      coordinatorId,
      createdById,
      origin: 'prospect',
      tradeName,
      status,
      ...(rejectionReason ? { rejectionReason } : {}),
    })
  await prospect(world.sellerA1.id, coordinatorA, 'Prospecção Pendente', 'pending_approval')
  await prospect(world.sellerA1.id, coordinatorA, 'Prospecção Aprovada', 'active')
  await prospect(
    world.sellerA1.id,
    coordinatorA,
    'Prospecção Rejeitada',
    'rejected',
    'Endereço inexistente',
  )
  await prospect(world.sellerA2.id, coordinatorA, 'Prospecção do A2', 'pending_approval')
  await prospect(world.sellerB1.id, world.coordinatorB.id, 'Prospecção do B1', 'pending_approval')
  await app.ready()
})
afterAll(async () => {
  await app.close()
  await testDb.drop()
})

async function get(user?: { id: string }) {
  return app.inject({
    method: 'GET',
    url: '/v1/sync/snapshot',
    headers: user ? await bearer(user) : {},
  })
}

async function snapshotOf(user: { id: string }): Promise<SyncSnapshot> {
  const response = await get(user)
  expect(response.statusCode).toBe(200)
  return syncSnapshotSchema.parse(response.json())
}

describe('GET /v1/sync/snapshot', () => {
  it('exige login', async () => {
    expect((await get()).statusCode).toBe(401)
  })

  it('é do Vendedor: Coordenador, Diretor e Administrador recebem 403', async () => {
    for (const user of [world.coordinatorA, world.director, world.admin]) {
      const response = await get(user)
      expect(response.statusCode).toBe(403)
      expect((response.json() as Problema).codigo).toBe('SEM_PERMISSAO')
    }
  })

  it('traz a rota de hoje e a de amanhã, com as Visitas e os Clientes, e mais nada', async () => {
    const { routes } = await snapshotOf(world.sellerA1)

    expect(routes.map((r) => r.date)).toEqual(['2026-11-03', '2026-11-04'])
    expect(routes.map((r) => r.sellerId)).toEqual([world.sellerA1.id, world.sellerA1.id])
    expect(routes[0]?.visits.map((v) => v.customer.tradeName)).toEqual([
      'Padaria Central',
      'Mercado Sul',
    ])
    expect(routes[1]?.visits.map((v) => v.customer.tradeName)).toEqual(['Kiosk'])
  })

  it('traz o raio do Check-in vigente', async () => {
    expect((await snapshotOf(world.sellerA1)).checkinRadiusMeters).toBe(150)
  })

  it('traz as Prospecções do próprio Vendedor com o estado e o motivo da rejeição', async () => {
    const { prospects } = await snapshotOf(world.sellerA1)

    expect(prospects.map((p) => [p.tradeName, p.status, p.rejectionReason]).sort()).toEqual([
      ['Prospecção Aprovada', 'active', null],
      ['Prospecção Pendente', 'pending_approval', null],
      ['Prospecção Rejeitada', 'rejected', 'Endereço inexistente'],
    ])
    expect(prospects.every((p) => p.origin === 'prospect')).toBe(true)
  })

  it('não traz nada de outro Vendedor nem de outra Equipe', async () => {
    const a2 = await snapshotOf(world.sellerA2)
    expect(a2.routes.map((r) => r.date)).toEqual(['2026-11-03'])
    expect(a2.prospects.map((p) => p.tradeName)).toEqual(['Prospecção do A2'])

    const b1 = await snapshotOf(world.sellerB1)
    expect(b1.routes.flatMap((r) => r.visits.map((v) => v.customer.tradeName))).toEqual([
      'Bar da Equipe B',
    ])
    expect(b1.prospects.map((p) => p.tradeName)).toEqual(['Prospecção do B1'])
  })

  it('sem rota hoje nem amanhã, a lista de rotas vem vazia (e não 404)', async () => {
    clock = new Date('2026-11-20T15:00:00Z')
    try {
      const snapshot = await snapshotOf(world.sellerA1)
      expect(snapshot.routes).toEqual([])
      expect(snapshot.prospects).toHaveLength(3)
    } finally {
      clock = TODAY
    }
  })

  it('usa o dia de São Paulo: às 23h30 de Brasília ainda é 03/11, embora em UTC já seja 04/11', async () => {
    clock = new Date('2026-11-04T02:30:00Z')
    try {
      const { routes } = await snapshotOf(world.sellerA1)
      expect(routes.map((r) => r.date)).toEqual(['2026-11-03', '2026-11-04'])
    } finally {
      clock = TODAY
    }
  })

  it('carimba o instante em que montou o snapshot', async () => {
    expect((await snapshotOf(world.sellerA1)).generatedAt).toBe(TODAY.toISOString())
  })
})
