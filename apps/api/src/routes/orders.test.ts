import { type Order, orderSchema, type Problema, pageOf, productSchema } from '@axis/contracts'
import { eq } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TEST_JWT_SECRET } from '../../test/support/config'
import { createTestDatabase, type TestDatabase } from '../../test/support/database'
import { insertCustomer, insertRoute } from '../../test/support/factories'
import { bearer, createWorld } from '../../test/support/world'
import { buildApp } from '../app'
import { customers, products } from '../db/schema'

const NOW = new Date('2026-11-10T15:00:00Z')

let testDb: TestDatabase
let app: Awaited<ReturnType<typeof buildApp>>
let world: Awaited<ReturnType<typeof createWorld>>
let cola: typeof products.$inferSelect
let water: typeof products.$inferSelect
let retired: typeof products.$inferSelect
let ongoing: { id: string; customerId: string }
let notStarted: { id: string }
let finished: { id: string }
let inactive: { id: string; customerId: string }

const newProduct = async (sku: string, unitPriceCents: number, active = true) => {
  const [row] = await testDb.db
    .insert(products)
    .values({
      id: uuidv7(),
      sku,
      name: `Produto ${sku}`,
      category: 'Bebidas',
      unitPriceCents,
      active,
    })
    .returning()
  return row as typeof products.$inferSelect
}

beforeAll(async () => {
  testDb = await createTestDatabase()
  app = await buildApp({ db: testDb.db, auth: { jwtSecret: TEST_JWT_SECRET }, now: () => NOW })
  world = await createWorld(testDb.db)
  cola = await newProduct('COLA', 949)
  water = await newProduct('AGUA', 249)
  retired = await newProduct('VELHO', 100, false)

  const coordinatorId = world.coordinatorA.id
  const [a, b, c, d] = await Promise.all(
    [1, 2, 3, 4].map(() => insertCustomer(testDb.db, { coordinatorId })),
  )
  const checkedInAt = new Date('2026-11-10T13:00:00Z')
  const { visits: rows } = await insertRoute(testDb.db, {
    sellerId: world.sellerA1.id,
    createdById: coordinatorId,
    date: '2026-11-10',
    visits: [
      { customerId: (a as { id: string }).id, checkedInAt },
      { customerId: (b as { id: string }).id },
      {
        customerId: (c as { id: string }).id,
        checkedInAt,
        checkedOutAt: new Date('2026-11-10T13:30:00Z'),
      },
      { customerId: (d as { id: string }).id, checkedInAt },
    ],
  })
  const [v1, v2, v3, v4] = rows as { id: string; customerId: string }[]
  ongoing = v1 as { id: string; customerId: string }
  notStarted = v2 as { id: string }
  finished = v3 as { id: string }
  inactive = v4 as { id: string; customerId: string }
  await testDb.db
    .update(customers)
    .set({ status: 'inactive' })
    .where(eq(customers.id, inactive.customerId))
})

afterAll(async () => {
  await app.close()
  await testDb.drop()
})

const post = async (user: { id: string }, payload: object) =>
  app.inject({ method: 'POST', url: '/v1/orders', headers: await bearer(user), payload })

const get = async (user: { id: string }, url: string) =>
  app.inject({ method: 'GET', url, headers: await bearer(user) })

describe('POST /v1/orders', () => {
  it('201: congela o preço do Produto e o total é a soma dos itens', async () => {
    const response = await post(world.sellerA1, {
      visitId: ongoing.id,
      items: [
        { productId: cola.id, quantity: 3 },
        { productId: water.id, quantity: 10 },
      ],
    })
    expect(response.statusCode).toBe(201)
    const order: Order = orderSchema.parse(response.json())
    expect(order.visitId).toBe(ongoing.id)
    expect(order.occurredAt).toBe(NOW.toISOString())
    expect(order.totalCents).toBe(3 * 949 + 10 * 249)
    expect(order.items.find((i) => i.productId === cola.id)?.unitPriceCents).toBe(949)

    // Reajustar o Produto depois não muda o Pedido já emitido.
    await testDb.db.update(products).set({ unitPriceCents: 1099 }).where(eq(products.id, cola.id))
    const read = await get(world.sellerA1, `/v1/orders?visitId=${ongoing.id}`)
    const [stored] = pageOf(orderSchema).parse(read.json()).items
    expect(stored?.items.find((i) => i.productId === cola.id)?.unitPriceCents).toBe(949)
    expect(stored?.totalCents).toBe(order.totalCents)
    await testDb.db.update(products).set({ unitPriceCents: 949 }).where(eq(products.id, cola.id))
  })

  it('409 sem check-in e depois do check-out', async () => {
    for (const visit of [notStarted, finished]) {
      const response = await post(world.sellerA1, {
        visitId: visit.id,
        items: [{ productId: cola.id, quantity: 1 }],
      })
      expect(response.statusCode).toBe(409)
      expect((response.json() as Problema).codigo).toBe('VISITA_FORA_DE_ANDAMENTO')
    }
  })

  it('409 CLIENTE_NAO_ATIVO se o Cliente foi inativado (RN04)', async () => {
    const response = await post(world.sellerA1, {
      visitId: inactive.id,
      items: [{ productId: cola.id, quantity: 1 }],
    })
    expect(response.statusCode).toBe(409)
    expect((response.json() as Problema).codigo).toBe('CLIENTE_NAO_ATIVO')
  })

  it('422 para Produto inativo ou inexistente', async () => {
    for (const productId of [retired.id, uuidv7()]) {
      const response = await post(world.sellerA1, {
        visitId: ongoing.id,
        items: [{ productId, quantity: 1 }],
      })
      expect(response.statusCode).toBe(422)
    }
  })

  it('422 para item repetido, lista vazia e quantidade zero', async () => {
    for (const items of [
      [
        { productId: cola.id, quantity: 1 },
        { productId: cola.id, quantity: 2 },
      ],
      [],
      [{ productId: cola.id, quantity: 0 }],
    ]) {
      const response = await post(world.sellerA1, { visitId: ongoing.id, items })
      expect(response.statusCode).toBe(422)
    }
  })

  it('404 na Visita de outro Vendedor; 403 para os demais perfis; 401 sem token', async () => {
    const payload = { visitId: ongoing.id, items: [{ productId: cola.id, quantity: 1 }] }
    expect((await post(world.sellerA2, payload)).statusCode).toBe(404)
    for (const user of [world.coordinatorA, world.director, world.admin]) {
      expect((await post(user, payload)).statusCode).toBe(403)
    }
    const anonymous = await app.inject({ method: 'POST', url: '/v1/orders', payload })
    expect(anonymous.statusCode).toBe(401)
  })
})

describe('GET /v1/orders', () => {
  it('o Vendedor e o Coordenador da Equipe veem o Pedido; a outra Equipe, não', async () => {
    const ids = async (user: { id: string }) =>
      pageOf(orderSchema)
        .parse((await get(user, '/v1/orders')).json())
        .items.map((o) => o.visitId)
    expect(await ids(world.sellerA1)).toContain(ongoing.id)
    expect(await ids(world.coordinatorA)).toContain(ongoing.id)
    expect(await ids(world.director)).toContain(ongoing.id)
    expect(await ids(world.sellerA2)).not.toContain(ongoing.id)
    expect(await ids(world.coordinatorB)).not.toContain(ongoing.id)
    expect((await get(world.admin, '/v1/orders')).statusCode).toBe(403)
  })
})

describe('GET /v1/products', () => {
  const skus = async (user: { id: string }, query = '') =>
    pageOf(productSchema)
      .parse((await get(user, `/v1/products${query}`)).json())
      .items.map((p) => p.sku)

  it('o Vendedor só vê os ativos; o Administrador vê todos e filtra', async () => {
    expect(await skus(world.sellerA1)).toEqual(['AGUA', 'COLA'])
    expect(await skus(world.admin)).toEqual(['AGUA', 'COLA', 'VELHO'])
    expect(await skus(world.admin, '?active=false')).toEqual(['VELHO'])
    expect(await skus(world.admin, '?sortBy=unitPriceCents&order=desc')).toEqual([
      'COLA',
      'AGUA',
      'VELHO',
    ])
    expect(await skus(world.admin, '?search=agu')).toEqual(['AGUA'])
  })

  it('401 sem token', async () => {
    expect((await app.inject({ method: 'GET', url: '/v1/products' })).statusCode).toBe(401)
  })
})
