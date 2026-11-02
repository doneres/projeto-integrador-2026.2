import { healthSchema } from '@axis/contracts'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDatabase, type TestDatabase } from '../../test/support/database'
import { buildApp } from '../app'
import { createDatabase } from '../db/client'

let testDb: TestDatabase

beforeAll(async () => {
  testDb = await createTestDatabase()
})
afterAll(async () => {
  await testDb.drop()
})

describe('GET /health', () => {
  it('responde 200 com o status no formato do contrato', async () => {
    const app = await buildApp({ db: testDb.db })

    const response = await app.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(200)
    expect(healthSchema.parse(response.json())).toEqual({ status: 'ok' })
    await app.close()
  })

  it('responde sem consultar o banco', async () => {
    // Banco inalcançável: qualquer consulta falharia e o /health viraria 500.
    const unreachable = createDatabase('postgres://nobody:nobody@127.0.0.1:1/none')
    const app = await buildApp({ db: unreachable.db })

    const response = await app.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(200)
    await app.close()
    await unreachable.close()
  })
})
