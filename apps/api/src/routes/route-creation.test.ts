import { type Problema, type RouteDetail, routeDetailSchema } from '@axis/contracts'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TEST_JWT_SECRET } from '../../test/support/config'
import { createTestDatabase, type TestDatabase } from '../../test/support/database'
import { insertCustomer, insertRoute } from '../../test/support/factories'
import { bearer, createWorld } from '../../test/support/world'
import { buildApp } from '../app'
import { routes, users, visits } from '../db/schema'

let testDb: TestDatabase
let app: Awaited<ReturnType<typeof buildApp>>
let world: Awaited<ReturnType<typeof createWorld>>
let teamA: Awaited<ReturnType<typeof insertCustomer>>[]
let inactiveA: Awaited<ReturnType<typeof insertCustomer>>
let pendingProspectA: Awaited<ReturnType<typeof insertCustomer>>
let customerB: Awaited<ReturnType<typeof insertCustomer>>

beforeAll(async () => {
  testDb = await createTestDatabase()
  app = await buildApp({ db: testDb.db, auth: { jwtSecret: TEST_JWT_SECRET } })
  world = await createWorld(testDb.db)
  const coordinatorId = world.coordinatorA.id
  teamA = await Promise.all(
    ['Padaria', 'Mercado', 'Bar'].map((tradeName) =>
      insertCustomer(testDb.db, { coordinatorId, tradeName }),
    ),
  )
  inactiveA = await insertCustomer(testDb.db, { coordinatorId, status: 'inactive' })
  pendingProspectA = await insertCustomer(testDb.db, {
    coordinatorId,
    origin: 'prospect',
    status: 'pending_approval',
    createdById: world.sellerA1.id,
  })
  customerB = await insertCustomer(testDb.db, { coordinatorId: world.coordinatorB.id })
})

afterAll(async () => {
  await app.close()
  await testDb.drop()
})

const post = async (user: { id: string }, payload: object) =>
  app.inject({ method: 'POST', url: '/v1/routes', headers: await bearer(user), payload })

const ids = (rows: { id: string }[]) => rows.map((row) => row.id)

describe('POST /v1/routes', () => {
  it('201: cria a rota e uma Visita Pendente por Cliente, na ordem enviada', async () => {
    const [padaria, mercado, bar] = teamA as [
      (typeof teamA)[0],
      (typeof teamA)[0],
      (typeof teamA)[0],
    ]
    const response = await post(world.coordinatorA, {
      sellerId: world.sellerA1.id,
      date: '2026-12-01',
      customerIds: [bar.id, padaria.id, mercado.id],
    })

    expect(response.statusCode).toBe(201)
    const route: RouteDetail = routeDetailSchema.parse(response.json())
    expect(route.sellerId).toBe(world.sellerA1.id)
    expect(route.date).toBe('2026-12-01')
    expect(route.createdById).toBe(world.coordinatorA.id)
    expect(route.visits.map((v) => [v.customer.id, v.position, v.status])).toEqual([
      [bar.id, 1, 'pending'],
      [padaria.id, 2, 'pending'],
      [mercado.id, 3, 'pending'],
    ])

    // E a leitura devolve a mesma rota.
    const read = await app.inject({
      method: 'GET',
      url: `/v1/routes/${route.id}`,
      headers: await bearer(world.coordinatorA),
    })
    expect(routeDetailSchema.parse(read.json())).toEqual(route)
  })

  it('409 ROTA_JA_EXISTE se o Vendedor já tem rota na data, sem criar Visitas', async () => {
    const date = '2026-12-02'
    const first = await post(world.coordinatorA, {
      sellerId: world.sellerA2.id,
      date,
      customerIds: ids(teamA),
    })
    expect(first.statusCode).toBe(201)
    const visitsBefore = await testDb.db.$count(visits)

    const again = await post(world.coordinatorA, {
      sellerId: world.sellerA2.id,
      date,
      customerIds: [teamA[0]?.id],
    })
    expect(again.statusCode).toBe(409)
    expect((again.json() as Problema).codigo).toBe('ROTA_JA_EXISTE')
    expect(await testDb.db.$count(visits)).toBe(visitsBefore)
  })

  it('409 também contra uma rota que já existia no banco', async () => {
    await insertRoute(testDb.db, {
      sellerId: world.sellerA1.id,
      createdById: world.coordinatorA.id,
      date: '2026-12-03',
      visits: [{ customerId: teamA[0]?.id as string }],
    })
    const response = await post(world.coordinatorA, {
      sellerId: world.sellerA1.id,
      date: '2026-12-03',
      customerIds: [teamA[1]?.id],
    })
    expect(response.statusCode).toBe(409)
  })

  describe('422 fora da Equipe ou do que pode entrar em rota', () => {
    const expectRejected = async (payload: object, field: string) => {
      const routesBefore = await testDb.db.$count(routes)
      const response = await post(world.coordinatorA, payload)
      expect(response.statusCode).toBe(422)
      const problem = response.json() as Problema
      expect(problem.codigo).toBe('VALIDACAO')
      expect(problem.erros?.map((e) => e.campo)).toEqual([field])
      expect(await testDb.db.$count(routes)).toBe(routesBefore)
    }

    it('Vendedor de outra Equipe', () =>
      expectRejected(
        { sellerId: world.sellerB1.id, date: '2026-12-10', customerIds: ids(teamA) },
        'sellerId',
      ))

    it('usuário que não é Vendedor (o próprio Coordenador)', () =>
      expectRejected(
        { sellerId: world.coordinatorA.id, date: '2026-12-10', customerIds: ids(teamA) },
        'sellerId',
      ))

    it('Vendedor que não existe', () =>
      expectRejected(
        {
          sellerId: '0192f4a0-0000-7000-8000-00000000dead',
          date: '2026-12-10',
          customerIds: ids(teamA),
        },
        'sellerId',
      ))

    it('Cliente de outra Equipe', () =>
      expectRejected(
        {
          sellerId: world.sellerA1.id,
          date: '2026-12-10',
          customerIds: [teamA[0]?.id, customerB.id],
        },
        'customerIds',
      ))

    it('Cliente Inativo', () =>
      expectRejected(
        { sellerId: world.sellerA1.id, date: '2026-12-10', customerIds: [inactiveA.id] },
        'customerIds',
      ))

    it('Prospecção Pendente de aprovação', () =>
      expectRejected(
        { sellerId: world.sellerA1.id, date: '2026-12-10', customerIds: [pendingProspectA.id] },
        'customerIds',
      ))

    it('Cliente que não existe', () =>
      expectRejected(
        {
          sellerId: world.sellerA1.id,
          date: '2026-12-10',
          customerIds: ['0192f4a0-0000-7000-8000-00000000beef'],
        },
        'customerIds',
      ))

    it('corpo inválido: Cliente repetido e lista vazia', async () => {
      for (const customerIds of [[teamA[0]?.id, teamA[0]?.id], []]) {
        const response = await post(world.coordinatorA, {
          sellerId: world.sellerA1.id,
          date: '2026-12-10',
          customerIds,
        })
        expect(response.statusCode).toBe(422)
      }
    })
  })

  it('422 para Vendedor desativado', async () => {
    await testDb.db.update(users).set({ active: false }).where(eq(users.id, world.sellerA2.id))
    try {
      const response = await post(world.coordinatorA, {
        sellerId: world.sellerA2.id,
        date: '2026-12-11',
        customerIds: ids(teamA),
      })
      expect(response.statusCode).toBe(422)
      expect((response.json() as Problema).erros?.[0]?.campo).toBe('sellerId')
    } finally {
      await testDb.db.update(users).set({ active: true }).where(eq(users.id, world.sellerA2.id))
    }
  })

  it('403 para Vendedor, Diretor e Administrador; 401 sem token', async () => {
    const payload = { sellerId: world.sellerA1.id, date: '2026-12-12', customerIds: ids(teamA) }
    for (const user of [world.sellerA1, world.director, world.admin]) {
      const response = await post(user, payload)
      expect(response.statusCode).toBe(403)
      expect((response.json() as Problema).codigo).toBe('SEM_PERMISSAO')
    }
    const anonymous = await app.inject({ method: 'POST', url: '/v1/routes', payload })
    expect(anonymous.statusCode).toBe(401)
  })
})
