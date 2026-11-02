import {
  type Page,
  type Problema,
  type Route,
  type RouteDetail,
  routeDetailSchema,
  routeSchema,
} from '@axis/contracts'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TEST_JWT_SECRET } from '../../test/support/config'
import { createTestDatabase, type TestDatabase } from '../../test/support/database'
import { insertCustomer, insertRoute } from '../../test/support/factories'
import { bearer, createWorld } from '../../test/support/world'
import { buildApp } from '../app'

const TODAY = new Date('2026-11-03T15:00:00Z') // 12h em Brasília, terça 03/11/2026
let clock = TODAY

let testDb: TestDatabase
let app: Awaited<ReturnType<typeof buildApp>>
let world: Awaited<ReturnType<typeof createWorld>>
let routeA1: Awaited<ReturnType<typeof insertRoute>>
let routeA2: Awaited<ReturnType<typeof insertRoute>>
let routeB1: Awaited<ReturnType<typeof insertRoute>>

beforeAll(async () => {
  testDb = await createTestDatabase()
  app = await buildApp({
    db: testDb.db,
    auth: { jwtSecret: TEST_JWT_SECRET },
    now: () => clock,
  })
  world = await createWorld(testDb.db)
  const coordinatorId = world.coordinatorA.id
  const customer = (tradeName: string) => insertCustomer(testDb.db, { coordinatorId, tradeName })
  const [padaria, mercado, bar, loja, kiosk] = await Promise.all(
    ['Padaria Central', 'Mercado Sul', 'Bar do Zé', 'Loja Norte', 'Kiosk'].map(customer),
  )
  if (!padaria || !mercado || !bar || !loja || !kiosk) throw new Error('clientes de teste')

  // Rota de hoje do vendedor A1: uma visita de cada estado, fora da ordem alfabética de propósito.
  routeA1 = await insertRoute(testDb.db, {
    sellerId: world.sellerA1.id,
    createdById: coordinatorId,
    date: '2026-11-03',
    visits: [
      { customerId: mercado.id },
      { customerId: padaria.id, checkedInAt: new Date('2026-11-03T13:00:00Z') },
      {
        customerId: bar.id,
        checkedInAt: new Date('2026-11-03T12:00:00Z'),
        checkedOutAt: new Date('2026-11-03T12:30:00Z'),
        outcome: 'sale_made',
      },
      {
        customerId: loja.id,
        checkedInAt: new Date('2026-11-03T11:00:00Z'),
        checkedOutAt: new Date('2026-11-03T11:10:00Z'),
        outcome: 'customer_closed',
        outcomeJustification: 'Loja fechada',
      },
    ],
  })
  // Outro dia do mesmo vendedor, e a rota de hoje de outros vendedores.
  await insertRoute(testDb.db, {
    sellerId: world.sellerA1.id,
    createdById: coordinatorId,
    date: '2026-11-04',
    visits: [{ customerId: kiosk.id }],
  })
  routeA2 = await insertRoute(testDb.db, {
    sellerId: world.sellerA2.id,
    createdById: coordinatorId,
    date: '2026-11-03',
    visits: [{ customerId: kiosk.id }],
  })
  const customerB = await insertCustomer(testDb.db, {
    coordinatorId: world.coordinatorB.id,
    tradeName: 'Cliente da Equipe B',
  })
  routeB1 = await insertRoute(testDb.db, {
    sellerId: world.sellerB1.id,
    createdById: world.coordinatorB.id,
    date: '2026-11-03',
    visits: [{ customerId: customerB.id }],
  })
  await app.ready()
})
afterAll(async () => {
  await app.close()
  await testDb.drop()
})

async function get(url: string, user?: { id: string }) {
  return app.inject({ method: 'GET', url, headers: user ? await bearer(user) : {} })
}

describe('GET /v1/routes/today', () => {
  it('exige login', async () => {
    expect((await get('/v1/routes/today')).statusCode).toBe(401)
  })

  it('entrega ao vendedor a rota do dia com as visitas pela posição e o cliente de cada uma', async () => {
    const response = await get('/v1/routes/today', world.sellerA1)

    expect(response.statusCode).toBe(200)
    const body = routeDetailSchema.parse(response.json())
    expect(body.id).toBe(routeA1.route.id)
    expect(body.date).toBe('2026-11-03')
    expect(body.visits.map((v) => v.position)).toEqual([1, 2, 3, 4])
    expect(body.visits.map((v) => v.customer.tradeName)).toEqual([
      'Mercado Sul',
      'Padaria Central',
      'Bar do Zé',
      'Loja Norte',
    ])
  })

  it('devolve o estado derivado de cada visita', async () => {
    const body = routeDetailSchema.parse((await get('/v1/routes/today', world.sellerA1)).json())

    expect(body.visits.map((v) => v.status)).toEqual([
      'pending',
      'in_progress',
      'completed',
      'not_performed',
    ])
  })

  it('usa o dia de São Paulo: às 23h30 de Brasília ainda é o mesmo dia, embora em UTC já seja o seguinte', async () => {
    clock = new Date('2026-11-04T02:30:00Z')
    try {
      const body = routeDetailSchema.parse((await get('/v1/routes/today', world.sellerA1)).json())
      expect(body.date).toBe('2026-11-03')
    } finally {
      clock = TODAY
    }
  })

  it('responde 404 quando o vendedor não tem rota no dia', async () => {
    clock = new Date('2026-11-10T15:00:00Z')
    try {
      const response = await get('/v1/routes/today', world.sellerA1)
      expect(response.statusCode).toBe(404)
      expect((response.json() as Problema).codigo).toBe('SEM_ROTA_HOJE')
    } finally {
      clock = TODAY
    }
  })

  it('é do vendedor: coordenador, diretor e administrador recebem 403', async () => {
    for (const user of [world.coordinatorA, world.director, world.admin]) {
      const response = await get('/v1/routes/today', user)
      expect(response.statusCode).toBe(403)
      expect((response.json() as Problema).codigo).toBe('SEM_PERMISSAO')
    }
  })
})

describe('GET /v1/routes/{id}', () => {
  it('o vendedor lê a própria rota, de qualquer dia', async () => {
    const response = await get(`/v1/routes/${routeA1.route.id}`, world.sellerA1)
    expect(response.statusCode).toBe(200)
    expect((response.json() as RouteDetail).visits).toHaveLength(4)
  })

  it('o vendedor não vê a rota de outro vendedor, nem da própria equipe: 404', async () => {
    expect((await get(`/v1/routes/${routeA2.route.id}`, world.sellerA1)).statusCode).toBe(404)
    expect((await get(`/v1/routes/${routeB1.route.id}`, world.sellerA1)).statusCode).toBe(404)
  })

  it('o coordenador lê a rota dos vendedores da sua equipe, não da outra', async () => {
    expect((await get(`/v1/routes/${routeA1.route.id}`, world.coordinatorA)).statusCode).toBe(200)
    expect((await get(`/v1/routes/${routeA2.route.id}`, world.coordinatorA)).statusCode).toBe(200)
    expect((await get(`/v1/routes/${routeB1.route.id}`, world.coordinatorA)).statusCode).toBe(404)
  })

  it('o diretor lê a rota de qualquer equipe', async () => {
    expect((await get(`/v1/routes/${routeA1.route.id}`, world.director)).statusCode).toBe(200)
    expect((await get(`/v1/routes/${routeB1.route.id}`, world.director)).statusCode).toBe(200)
  })

  it('o administrador não lê rotas: 403', async () => {
    expect((await get(`/v1/routes/${routeA1.route.id}`, world.admin)).statusCode).toBe(403)
  })

  it('responde 404 para rota inexistente e 422 para id que não é UUID', async () => {
    expect(
      (await get('/v1/routes/0192f4a0-0000-7000-8000-000000000000', world.director)).statusCode,
    ).toBe(404)
    expect((await get('/v1/routes/abc', world.director)).statusCode).toBe(422)
  })
})

describe('GET /v1/routes', () => {
  const idsOf = (response: { json: () => unknown }) =>
    (response.json() as Page<Route>).items.map((route) => route.id).sort()

  it('o vendedor lista só as próprias rotas', async () => {
    const body = (await get('/v1/routes', world.sellerA1)).json() as Page<Route>

    expect(body.total).toBe(2)
    expect(body.items.every((route) => route.sellerId === world.sellerA1.id)).toBe(true)
  })

  it('o coordenador lista as rotas da sua equipe', async () => {
    const ids = idsOf(await get('/v1/routes?date=2026-11-03', world.coordinatorA))
    expect(ids).toEqual([routeA1.route.id, routeA2.route.id].sort())
  })

  it('o diretor lista as de todas as equipes e filtra por vendedor', async () => {
    expect(idsOf(await get('/v1/routes?date=2026-11-03', world.director))).toEqual(
      [routeA1.route.id, routeA2.route.id, routeB1.route.id].sort(),
    )
    expect(idsOf(await get(`/v1/routes?sellerId=${world.sellerB1.id}`, world.director))).toEqual([
      routeB1.route.id,
    ])
  })

  it('filtrar por vendedor de outra equipe não vaza nada para o coordenador', async () => {
    const response = await get(`/v1/routes?sellerId=${world.sellerB1.id}`, world.coordinatorA)
    expect(response.statusCode).toBe(200)
    expect((response.json() as Page<Route>).items).toEqual([])
  })

  it('pagina, com a rota mais recente primeiro', async () => {
    const first = (await get('/v1/routes?perPage=1&page=1', world.sellerA1)).json() as Page<Route>
    const second = (await get('/v1/routes?perPage=1&page=2', world.sellerA1)).json() as Page<Route>

    expect(first).toMatchObject({ total: 2, page: 1, perPage: 1 })
    expect(first.items.map((route) => route.date)).toEqual(['2026-11-04'])
    expect(second.items.map((route) => route.date)).toEqual(['2026-11-03'])
    routeSchema.parse(second.items[0])
  })

  it('o administrador recebe 403', async () => {
    expect((await get('/v1/routes', world.admin)).statusCode).toBe(403)
  })
})
