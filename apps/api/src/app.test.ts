import { problemaSchema } from '@axis/contracts'
import { sql } from 'drizzle-orm'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { TEST_JWT_SECRET } from '../test/support/config'
import { createTestDatabase, type TestDatabase } from '../test/support/database'
import { buildApp } from './app'

let testDb: TestDatabase
let app: Awaited<ReturnType<typeof buildApp>>

beforeAll(async () => {
  testDb = await createTestDatabase()
  app = await buildApp({ db: testDb.db, auth: { jwtSecret: TEST_JWT_SECRET } })
  app
    .withTypeProvider<ZodTypeProvider>()
    .post(
      '/echo',
      { schema: { body: z.object({ name: z.string().min(3) }) } },
      async (request) => request.body,
    )
  app.get('/boom', async () => {
    throw new Error('segredo interno')
  })
  await app.ready()
})
afterAll(async () => {
  await app.close()
  await testDb.drop()
})

describe('banco de dados', () => {
  it('chega com as migrations aplicadas', async () => {
    const rows = await app.db.execute(
      sql`SELECT count(*)::int AS applied FROM drizzle.__drizzle_migrations`,
    )

    expect(rows[0]?.applied).toBeGreaterThanOrEqual(1)
  })
})

describe('documentação', () => {
  it('serve o Scalar em /docs/', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs/' })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/html')
  })

  it('gera o OpenAPI a partir dos schemas das rotas', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs/openapi.json' })

    expect(response.statusCode).toBe(200)
    const spec = response.json()
    expect(spec.openapi).toMatch(/^3\./)
    expect(spec.paths['/health'].get.responses['200']).toBeDefined()
  })

  it('documenta as rotas de clientes e de rotas do dia', async () => {
    const spec = (await app.inject({ method: 'GET', url: '/docs/openapi.json' })).json()

    const documented = Object.entries(spec.paths as Record<string, object>).flatMap(
      ([path, methods]) => Object.keys(methods).map((method) => `${method.toUpperCase()} ${path}`),
    )
    expect(documented).toEqual(
      expect.arrayContaining([
        'GET /v1/customers',
        'POST /v1/customers',
        'GET /v1/customers/{id}',
        'PUT /v1/customers/{id}',
        'PATCH /v1/customers/{id}/status',
        'GET /v1/routes',
        'GET /v1/routes/today',
        'GET /v1/routes/{id}',
      ]),
    )
    expect(spec.paths['/v1/routes/today'].get.responses['200']).toBeDefined()
  })
})

describe('erros', () => {
  it('rota inexistente responde 404 em Problem Details', async () => {
    const response = await app.inject({ method: 'GET', url: '/nao-existe' })

    expect(response.statusCode).toBe(404)
    expect(response.headers['content-type']).toContain('application/problem+json')
    expect(problemaSchema.parse(response.json())).toMatchObject({
      status: 404,
      codigo: 'NAO_ENCONTRADO',
    })
  })

  it('corpo inválido responde 422 listando o campo', async () => {
    const response = await app.inject({ method: 'POST', url: '/echo', payload: { name: 'ab' } })

    expect(response.statusCode).toBe(422)
    expect(response.headers['content-type']).toContain('application/problem+json')
    const problem = problemaSchema.parse(response.json())
    expect(problem.codigo).toBe('VALIDACAO')
    expect(problem.erros?.map((e) => e.campo)).toEqual(['name'])
  })

  it('JSON quebrado responde 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/echo',
      headers: { 'content-type': 'application/json' },
      payload: '{ quebrado',
    })

    expect(response.statusCode).toBe(400)
    expect(problemaSchema.parse(response.json()).codigo).toBe('REQUISICAO_INVALIDA')
  })

  it('falha inesperada responde 500 sem expor a mensagem interna', async () => {
    const response = await app.inject({ method: 'GET', url: '/boom' })

    expect(response.statusCode).toBe(500)
    expect(response.body).not.toContain('segredo interno')
    expect(problemaSchema.parse(response.json()).codigo).toBe('ERRO_INTERNO')
  })
})
