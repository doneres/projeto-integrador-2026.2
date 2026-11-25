import { type Problema, pageOf, userSchema } from '@axis/contracts'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TEST_JWT_SECRET } from '../../test/support/config'
import { createTestDatabase, type TestDatabase } from '../../test/support/database'
import { bearer, createWorld } from '../../test/support/world'
import { buildApp } from '../app'
import { users } from '../db/schema'
import { createUser } from '../users/create-user'

let testDb: TestDatabase
let app: Awaited<ReturnType<typeof buildApp>>
let world: Awaited<ReturnType<typeof createWorld>>
let disabledA: Awaited<ReturnType<typeof createUser>>

const userPage = pageOf(userSchema)

beforeAll(async () => {
  testDb = await createTestDatabase()
  app = await buildApp({ db: testDb.db, auth: { jwtSecret: TEST_JWT_SECRET } })
  world = await createWorld(testDb.db)
  disabledA = await createUser(testDb.db, {
    name: 'seller-a-disabled',
    email: 'seller-a-disabled@axis.test',
    registration: 'disabled1',
    password: 'senha-do-teste',
    role: 'seller',
    coordinatorId: world.coordinatorA.id,
  })
  await testDb.db.update(users).set({ active: false }).where(eq(users.id, disabledA.id))
})

afterAll(async () => {
  await app.close()
  await testDb.drop()
})

const list = async (user: { id: string }, query = '') =>
  app.inject({ method: 'GET', url: `/v1/users${query}`, headers: await bearer(user) })

const namesOf = async (user: { id: string }, query: string) => {
  const response = await list(user, query)
  expect(response.statusCode).toBe(200)
  return userPage.parse(response.json()).items.map((u) => u.name)
}

describe('GET /v1/users', () => {
  it('Coordenador: só os Vendedores ativos da sua Equipe, por nome', async () => {
    expect(await namesOf(world.coordinatorA, '?role=seller')).toEqual(['seller-a1', 'seller-a2'])
    expect(await namesOf(world.coordinatorB, '?role=seller')).toEqual(['seller-b1'])
  })

  it('Diretor: todos os Vendedores ativos', async () => {
    expect(await namesOf(world.director, '?role=seller')).toEqual([
      'seller-a1',
      'seller-a2',
      'seller-b1',
    ])
  })

  it('o Vendedor desativado não aparece', async () => {
    for (const user of [world.coordinatorA, world.director]) {
      expect(await namesOf(user, '?role=seller')).not.toContain('seller-a-disabled')
    }
  })

  it('não expõe o hash da senha e respeita a paginação', async () => {
    const response = await list(world.director, '?role=seller&perPage=2&page=2')
    const body = response.json()
    expect(userPage.parse(body)).toMatchObject({ total: 3, page: 2, perPage: 2 })
    expect(body.items.map((u: { name: string }) => u.name)).toEqual(['seller-b1'])
    expect(JSON.stringify(body)).not.toContain('passwordHash')
  })

  it('sem filtro, o Coordenador vê a Equipe (ele e os Vendedores); o Diretor, todos os ativos', async () => {
    expect(await namesOf(world.coordinatorA, '')).toEqual(['coord-a', 'seller-a1', 'seller-a2'])
    expect(await namesOf(world.director, '')).toEqual([
      'admin',
      'coord-a',
      'coord-b',
      'director',
      'seller-a1',
      'seller-a2',
      'seller-b1',
    ])
  })

  it('403 para Vendedor e Administrador; 401 sem token; 422 para perfil inválido', async () => {
    for (const user of [world.sellerA1, world.admin]) {
      const response = await list(user, '?role=seller')
      expect(response.statusCode).toBe(403)
      expect((response.json() as Problema).codigo).toBe('SEM_PERMISSAO')
    }
    expect((await app.inject({ method: 'GET', url: '/v1/users' })).statusCode).toBe(401)
    expect((await list(world.director, '?role=manager')).statusCode).toBe(422)
  })
})
