import { type Goal, goalSchema, goalsMonthlyReportSchema } from '@axis/contracts'
import { eq } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TEST_JWT_SECRET } from '../../test/support/config'
import { createTestDatabase, type TestDatabase } from '../../test/support/database'
import { insertCustomer, insertRoute } from '../../test/support/factories'
import { bearer, createWorld } from '../../test/support/world'
import { buildApp } from '../app'
import { orderItems, products, salesOrders, systemSettings, users } from '../db/schema'

const NOW = new Date('2026-11-20T15:00:00Z')

let testDb: TestDatabase
let app: Awaited<ReturnType<typeof buildApp>>
let world: Awaited<ReturnType<typeof createWorld>>

beforeAll(async () => {
  testDb = await createTestDatabase()
  app = await buildApp({ db: testDb.db, auth: { jwtSecret: TEST_JWT_SECRET }, now: () => NOW })
  world = await createWorld(testDb.db)
  await testDb.db.insert(systemSettings).values({
    checkinRadiusMeters: 100,
    scoreWeightRevenue: 50,
    scoreWeightVisits: 30,
    scoreWeightNewCustomers: 20,
  })

  // O Vendedor A1 vendeu R$ 1.000,00 em 2 Visitas Concluídas em novembro; o A2 não fez nada.
  const [product] = await testDb.db
    .insert(products)
    .values({ id: uuidv7(), sku: 'X', name: 'X', category: 'X', unitPriceCents: 10_000 })
    .returning()
  const coordinatorId = world.coordinatorA.id
  const customers = await Promise.all(
    [1, 2, 3].map(() => insertCustomer(testDb.db, { coordinatorId })),
  )
  const checkedInAt = new Date('2026-11-05T13:00:00Z')
  const checkedOutAt = new Date('2026-11-05T14:00:00Z')
  const { visits: rows } = await insertRoute(testDb.db, {
    sellerId: world.sellerA1.id,
    createdById: coordinatorId,
    date: '2026-11-05',
    visits: [
      { customerId: customers[0]?.id as string, checkedInAt, checkedOutAt },
      { customerId: customers[1]?.id as string, checkedInAt, checkedOutAt },
      {
        customerId: customers[2]?.id as string,
        checkedInAt,
        checkedOutAt,
        outcome: 'not_performed',
        outcomeJustification: 'Fechado',
      },
    ],
  })
  const [order] = await testDb.db
    .insert(salesOrders)
    .values({ id: uuidv7(), visitId: rows?.[0]?.id as string, occurredAt: checkedInAt })
    .returning()
  await testDb.db.insert(orderItems).values({
    id: uuidv7(),
    orderId: (order as { id: string }).id,
    productId: (product as { id: string }).id,
    quantity: 10,
    unitPriceCents: 10_000,
  })
})

afterAll(async () => {
  await app.close()
  await testDb.drop()
})

const put = async (user: { id: string }, sellerId: string, month: string, payload: object) =>
  app.inject({
    method: 'PUT',
    url: `/v1/goals/${sellerId}/${month}`,
    headers: await bearer(user),
    payload,
  })

const report = async (user: { id: string }, query = '') => {
  const response = await app.inject({
    method: 'GET',
    url: `/v1/goals${query}`,
    headers: await bearer(user),
  })
  expect(response.statusCode).toBe(200)
  return goalsMonthlyReportSchema.parse(response.json())
}

describe('PUT /v1/goals/{sellerId}/{month}', () => {
  it('o Diretor define a Meta, com o primeiro dia do mês, e depois a substitui', async () => {
    const first = await put(world.director, world.sellerA1.id, '2026-11', {
      revenueTargetCents: 200_000,
      visitsTarget: 4,
    })
    expect(first.statusCode).toBe(200)
    const goal: Goal = goalSchema.parse(first.json())
    expect(goal).toMatchObject({
      month: '2026-11-01',
      revenueTargetCents: 200_000,
      visitsTarget: 4,
      newCustomersTarget: null,
      setById: world.director.id,
    })

    const second = await put(world.director, world.sellerA1.id, '2026-11', { visitsTarget: 2 })
    expect(goalSchema.parse(second.json())).toMatchObject({
      id: goal.id,
      revenueTargetCents: null,
      visitsTarget: 2,
    })
  })

  it('403 para os demais perfis e 404 para quem não é Vendedor', async () => {
    for (const user of [world.sellerA1, world.coordinatorA, world.admin]) {
      expect((await put(user, world.sellerA1.id, '2026-11', {})).statusCode).toBe(403)
    }
    expect((await put(world.director, world.coordinatorA.id, '2026-11', {})).statusCode).toBe(404)
    expect((await put(world.director, uuidv7(), '2026-11', {})).statusCode).toBe(404)
  })

  it('422 para mês inválido e para alvo negativo', async () => {
    expect((await put(world.director, world.sellerA1.id, '2026-13', {})).statusCode).toBe(422)
    expect(
      (await put(world.director, world.sellerA1.id, '2026-11', { visitsTarget: -1 })).statusCode,
    ).toBe(422)
  })
})

describe('GET /v1/goals', () => {
  it('calcula o realizado e o Score na leitura, com o teto de 100 % por indicador', async () => {
    await put(world.director, world.sellerA1.id, '2026-11', {
      revenueTargetCents: 50_000, // realizado R$ 1.000: 200 %, teto 100 %
      visitsTarget: 4, // 2 Concluídas de 4: 50 %
      newCustomersTarget: null, // sem meta: fica fora do Score
    })
    const { sellers, weights } = await report(world.director, '?month=2026-11')
    expect(weights).toEqual({ revenue: 50, visits: 30, newCustomers: 20 })
    const a1 = sellers.find((s) => s.sellerId === world.sellerA1.id)
    expect(a1?.revenue).toMatchObject({ realized: 100_000, percent: 200, cappedPercent: 100 })
    expect(a1?.visits).toMatchObject({ realized: 2, percent: 50, cappedPercent: 50 })
    expect(a1?.newCustomers.cappedPercent).toBeNull()
    // (50 * 100 + 30 * 50) / (50 + 30) = 81,25
    expect(a1?.score).toBeCloseTo(81.3, 1)
  })

  it('Vendedor sem Meta: hasGoal falso e Score nulo; o mês padrão é o corrente', async () => {
    const { month, sellers } = await report(world.director)
    expect(month).toBe('2026-11')
    const a2 = sellers.find((s) => s.sellerId === world.sellerA2.id)
    expect(a2).toMatchObject({ hasGoal: false, score: null })
    expect(a2?.revenue.realized).toBe(0)
  })

  it('só conta o mês pedido: outubro está sem realizado', async () => {
    const { sellers } = await report(world.director, '?month=2026-10')
    expect(sellers.every((s) => s.revenue.realized === 0 && s.score === null)).toBe(true)
  })

  it('escopo: o Vendedor vê só a si, o Coordenador a Equipe e o Diretor todos', async () => {
    const ids = async (user: { id: string }) =>
      (await report(user)).sellers.map((s) => s.sellerId).sort()
    expect(await ids(world.sellerA1)).toEqual([world.sellerA1.id])
    expect(await ids(world.coordinatorA)).toEqual([world.sellerA1.id, world.sellerA2.id].sort())
    expect(await ids(world.coordinatorB)).toEqual([world.sellerB1.id])
    expect(await ids(world.director)).toHaveLength(3)
  })

  it('só Vendedores ativos; 403 para o Administrador; 401 sem token', async () => {
    await testDb.db.update(users).set({ active: false }).where(eq(users.id, world.sellerA2.id))
    try {
      const ids = (await report(world.director)).sellers.map((s) => s.sellerId)
      expect(ids).not.toContain(world.sellerA2.id)
    } finally {
      await testDb.db.update(users).set({ active: true }).where(eq(users.id, world.sellerA2.id))
    }
    const admin = await app.inject({
      method: 'GET',
      url: '/v1/goals',
      headers: await bearer(world.admin),
    })
    expect(admin.statusCode).toBe(403)
    expect((await app.inject({ method: 'GET', url: '/v1/goals' })).statusCode).toBe(401)
  })
})
