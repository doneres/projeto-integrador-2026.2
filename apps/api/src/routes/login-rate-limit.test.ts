import { problemaSchema } from '@axis/contracts'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TEST_JWT_SECRET } from '../../test/support/config'
import { createTestDatabase, type TestDatabase } from '../../test/support/database'
import { buildApp } from '../app'
import { createUser } from '../users/create-user'

const MAX_ATTEMPTS = 3

let testDb: TestDatabase
let app: Awaited<ReturnType<typeof buildApp>>

beforeAll(async () => {
  testDb = await createTestDatabase()
  app = await buildApp({
    db: testDb.db,
    auth: {
      jwtSecret: TEST_JWT_SECRET,
      loginRateLimit: { max: MAX_ATTEMPTS, windowMs: 60_000 },
    },
  })
  await createUser(testDb.db, {
    name: 'Davi Diretor',
    email: 'davi@axis.test',
    registration: '1001',
    password: 'senha-do-teste',
    role: 'director',
  })
})
afterAll(async () => {
  await app.close()
  await testDb.drop()
})

function login(password: string, ip = '10.0.0.1') {
  return app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    remoteAddress: ip,
    payload: { identifier: 'davi@axis.test', password },
  })
}

describe('limite de tentativas do login', () => {
  it('bloqueia o endereço depois de muitas tentativas, até com a senha certa', async () => {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      expect((await login('senha-errada')).statusCode).toBe(401)
    }

    const blocked = await login('senha-do-teste')

    expect(blocked.statusCode).toBe(429)
    expect(blocked.headers['content-type']).toContain('application/problem+json')
    expect(blocked.headers['retry-after']).toBeDefined()
    expect(problemaSchema.parse(blocked.json())).toMatchObject({
      status: 429,
      codigo: 'MUITAS_TENTATIVAS',
    })
  })

  it('não afeta outro endereço nem as demais rotas', async () => {
    expect((await login('senha-do-teste', '10.0.0.2')).statusCode).toBe(200)
    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200)
  })
})

describe('atrás de um proxy', () => {
  it('conta pelo endereço visto pelo proxy, não pelo que o cliente escreve no X-Forwarded-For', async () => {
    const proxied = await buildApp({
      db: testDb.db,
      auth: {
        jwtSecret: TEST_JWT_SECRET,
        loginRateLimit: { max: MAX_ATTEMPTS, windowMs: 60_000 },
      },
      trustProxy: 1,
    })
    // O proxy (10.0.0.1) acrescenta o endereço real do cliente (9.9.9.9) ao fim do cabeçalho; o
    // que vem antes é forjado pelo cliente.
    const attempt = (forged: string) =>
      proxied.inject({
        method: 'POST',
        url: '/v1/auth/login',
        remoteAddress: '10.0.0.1',
        headers: { 'x-forwarded-for': `${forged}, 9.9.9.9` },
        payload: { identifier: 'davi@axis.test', password: 'senha-errada' },
      })

    for (let n = 0; n < MAX_ATTEMPTS; n++) {
      expect((await attempt(`1.1.1.${n}`)).statusCode).toBe(401)
    }

    expect((await attempt('1.1.1.99')).statusCode).toBe(429)
    await proxied.close()
  })
})
