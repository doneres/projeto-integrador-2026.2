import { healthSchema } from '@axis/contracts'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TEST_JWT_SECRET } from '../../test/support/config'
import { createTestDatabase, type TestDatabase } from '../../test/support/database'
import { buildApp } from '../app'
import { createDatabase } from '../db/client'

let testDb: TestDatabase
let app: Awaited<ReturnType<typeof buildApp>>
// Banco inalcançável: qualquer consulta falharia e o /health viraria 500.
const unreachable = createDatabase('postgres://nobody:nobody@127.0.0.1:1/none')
let appWithoutDatabase: Awaited<ReturnType<typeof buildApp>>

beforeAll(async () => {
  testDb = await createTestDatabase()
  app = await buildApp({ db: testDb.db, auth: { jwtSecret: TEST_JWT_SECRET } })
  appWithoutDatabase = await buildApp({ db: unreachable.db, auth: { jwtSecret: TEST_JWT_SECRET } })
})
afterAll(async () => {
  await Promise.all([app.close(), appWithoutDatabase.close()])
  await unreachable.close()
  await testDb.drop()
})

describe('GET /health', () => {
  it('responde 200 com o status no formato do contrato', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(200)
    expect(healthSchema.parse(response.json())).toEqual({ status: 'ok' })
  })

  it('responde sem consultar o banco', async () => {
    const response = await appWithoutDatabase.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(200)
  })
})
