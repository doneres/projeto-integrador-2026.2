import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { TEST_JWT_SECRET } from '../../test/support/config'
import { createTestDatabase, type TestDatabase } from '../../test/support/database'
import { insertCustomer, insertRoute } from '../../test/support/factories'
import { buildApp } from '../app'
import { systemSettings, users } from '../db/schema'
import { createUser } from '../users/create-user'
import { type SeedPasswords, seedBase } from './base'
import { loadDatabaseTarget } from './env'
import { ResetRefusedError, resetDatabase } from './reset'

const PASSWORD = 'senha-teste-de-todos'
const passwords: SeedPasswords = {
  seller: PASSWORD,
  coordinator: PASSWORD,
  director: PASSWORD,
  administrator: PASSWORD,
}

const NEON_HOST = 'ep-exemplo.us-east-1.aws.neon.tech'
// Só o alvo vem destas URLs: a conexão é sempre a do banco de teste.
const local = loadDatabaseTarget({
  DATABASE_URL_UNPOOLED: 'postgres://axis:axis@localhost:5432/axis',
})
const production = loadDatabaseTarget({
  NODE_ENV: 'production',
  DATABASE_URL_UNPOOLED: `postgres://axis:segredo@${NEON_HOST}/axis?sslmode=require`,
})

let testDb: TestDatabase
let app: Awaited<ReturnType<typeof buildApp>>

beforeAll(async () => {
  testDb = await createTestDatabase()
  app = await buildApp({
    db: testDb.db,
    auth: { jwtSecret: TEST_JWT_SECRET, loginRateLimit: { max: 10_000, windowMs: 60_000 } },
  })
})
afterAll(async () => {
  await app.close()
  await testDb.drop()
})

beforeEach(async () => {
  await resetDatabase(testDb.db, local)
  await seedBase(testDb.db, passwords)
})

async function sellerCanLogin() {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { identifier: '2001', password: PASSWORD },
  })
  return response.statusCode === 200
}

describe('resetDatabase', () => {
  it('em dev, zera sem pedir confirmação', async () => {
    await resetDatabase(testDb.db, local)

    expect(await sellerCanLogin()).toBe(false)
    expect(await testDb.db.$count(users)).toBe(0)
    expect(await testDb.db.$count(systemSettings)).toBe(0)
  })

  it('zera também as tabelas ligadas por chave estrangeira', async () => {
    const coordinator = await createUser(testDb.db, {
      name: 'Coord',
      email: 'coord@axis.test',
      registration: 'coord',
      password: PASSWORD,
      role: 'coordinator',
    })
    const seller = await createUser(testDb.db, {
      name: 'Seller',
      email: 'seller@axis.test',
      registration: 'seller',
      password: PASSWORD,
      role: 'seller',
      coordinatorId: coordinator.id,
    })
    const customer = await insertCustomer(testDb.db, { coordinatorId: coordinator.id })
    await insertRoute(testDb.db, {
      sellerId: seller.id,
      createdById: coordinator.id,
      date: '2026-11-06',
      visits: [{ customerId: customer.id }],
    })

    await resetDatabase(testDb.db, local)

    expect(await testDb.db.$count(users)).toBe(0)
  })

  it('o seed roda de novo depois do reset, sem perder o histórico das migrations', async () => {
    const journal = sql`SELECT count(*)::int AS total FROM drizzle.__drizzle_migrations`
    const [before] = await testDb.db.execute<{ total: number }>(journal)

    await resetDatabase(testDb.db, local)
    await seedBase(testDb.db, passwords)

    const [after] = await testDb.db.execute<{ total: number }>(journal)
    expect(before?.total).toBeGreaterThan(0)
    expect(after?.total).toBe(before?.total)
    expect(await sellerCanLogin()).toBe(true)
  })

  describe('em production', () => {
    it('sem confirmação, recusa, diz o host e não apaga nada', async () => {
      const attempt = resetDatabase(testDb.db, production)

      await expect(attempt).rejects.toBeInstanceOf(ResetRefusedError)
      await expect(attempt).rejects.toThrow(NEON_HOST)
      expect(await sellerCanLogin()).toBe(true)
    })

    it('com a confirmação de outro host, recusa e não apaga nada', async () => {
      const attempt = resetDatabase(testDb.db, production, { confirmHost: 'localhost' })

      await expect(attempt).rejects.toBeInstanceOf(ResetRefusedError)
      expect(await sellerCanLogin()).toBe(true)
    })

    it('com a confirmação do host certo, imprime o host e zera', async () => {
      const printed: string[] = []

      await resetDatabase(testDb.db, production, {
        confirmHost: NEON_HOST,
        log: (line) => printed.push(line),
      })

      expect(printed.join('\n')).toContain(NEON_HOST)
      expect(await sellerCanLogin()).toBe(false)
    })
  })
})
