import { problemaSchema, sessionSchema, userSchema } from '@axis/contracts'
import { eq } from 'drizzle-orm'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { SignJWT } from 'jose'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { TEST_JWT_SECRET } from '../../test/support/config'
import { createTestDatabase, type TestDatabase } from '../../test/support/database'
import { buildApp } from '../app'
import { users } from '../db/schema'
import { createUser } from '../users/create-user'

const PASSWORD = 'senha-do-teste'
const EIGHT_HOURS_SECONDS = 8 * 60 * 60

let testDb: TestDatabase
let app: Awaited<ReturnType<typeof buildApp>>
let coordinatorId: string

beforeAll(async () => {
  testDb = await createTestDatabase()
  app = await buildApp({
    db: testDb.db,
    // Teto alto: esta suíte faz dezenas de logins do mesmo endereço (o limite tem teste próprio).
    auth: { jwtSecret: TEST_JWT_SECRET, loginRateLimit: { max: 10_000, windowMs: 60_000 } },
  })
  const coordinator = await createUser(testDb.db, {
    name: 'Carla Coordenadora',
    email: 'carla@axis.test',
    registration: '2001',
    password: PASSWORD,
    role: 'coordinator',
  })
  coordinatorId = coordinator.id
  await createUser(testDb.db, {
    name: 'Vera Vendedora',
    email: 'vera@axis.test',
    registration: '3001',
    password: PASSWORD,
    role: 'seller',
    coordinatorId,
  })
  await createUser(testDb.db, {
    name: 'Davi Diretor',
    email: 'davi@axis.test',
    registration: '1001',
    password: PASSWORD,
    role: 'director',
  })
  await createUser(testDb.db, {
    name: 'Ana Administradora',
    email: 'ana@axis.test',
    registration: '9001',
    password: PASSWORD,
    role: 'administrator',
  })
  // Rota com corpo, para provar que a autenticação vem antes da validação.
  app.withTypeProvider<ZodTypeProvider>().post(
    '/protected-echo',
    {
      onRequest: app.authenticate,
      schema: { body: z.object({ name: z.string().min(3) }) },
    },
    async (request) => request.body,
  )
  await app.ready()
})
afterAll(async () => {
  await app.close()
  await testDb.drop()
})

function login(identifier: string, password = PASSWORD) {
  return app.inject({ method: 'POST', url: '/v1/auth/login', payload: { identifier, password } })
}

async function loginToken(identifier: string) {
  return sessionSchema.parse((await login(identifier)).json()).token
}

function me(token?: string) {
  return app.inject({
    method: 'GET',
    url: '/v1/me',
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
  })
}

async function userIdOf(email: string) {
  const [row] = await testDb.db.select().from(users).where(eq(users.email, email))
  if (!row) throw new Error(`usuário ${email} não existe no banco de teste`)
  return row.id
}

/** Token assinado "por fora", para simular vencido ou de outro emissor. */
function signTestToken(userId: string, { secret = TEST_JWT_SECRET, expiresInMs = 60_000 } = {}) {
  const now = Date.now()
  return new SignJWT()
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt(Math.floor((now - 3_600_000) / 1000))
    .setExpirationTime(Math.floor((now + expiresInMs) / 1000))
    .sign(new TextEncoder().encode(secret))
}

describe('POST /v1/auth/login', () => {
  it('entra com o e-mail e devolve a sessão sem expor a senha', async () => {
    const response = await login('vera@axis.test')

    expect(response.statusCode).toBe(200)
    const session = sessionSchema.parse(response.json())
    expect(session.user).toMatchObject({
      name: 'Vera Vendedora',
      email: 'vera@axis.test',
      registration: '3001',
      role: 'seller',
      coordinatorId,
    })
    expect(response.body).not.toContain('passwordHash')
    expect(response.body).not.toContain(PASSWORD)
  })

  it('entra com a matrícula', async () => {
    const response = await login('3001')

    expect(response.statusCode).toBe(200)
    expect(sessionSchema.parse(response.json()).user.email).toBe('vera@axis.test')
  })

  it('ignora maiúsculas e espaços no e-mail', async () => {
    const response = await login('  Vera@AXIS.test ')

    expect(response.statusCode).toBe(200)
  })

  it.each([
    ['seller', 'vera@axis.test'],
    ['coordinator', 'carla@axis.test'],
    ['director', 'davi@axis.test'],
    ['administrator', 'ana@axis.test'],
  ])('entra como %s', async (role, email) => {
    const response = await login(email)

    expect(response.statusCode).toBe(200)
    expect(sessionSchema.parse(response.json()).user.role).toBe(role)
  })

  it('emite um token que vale 8 horas', async () => {
    const before = Math.floor(Date.now() / 1000)
    const session = sessionSchema.parse((await login('vera@axis.test')).json())
    const after = Math.ceil(Date.now() / 1000)

    const claims = JSON.parse(
      Buffer.from(session.token.split('.')[1] ?? '', 'base64url').toString(),
    )
    expect(claims.exp - claims.iat).toBe(EIGHT_HOURS_SECONDS)
    expect(claims.iat).toBeGreaterThanOrEqual(before)
    expect(claims.iat).toBeLessThanOrEqual(after)
    expect(Date.parse(session.expiresAt)).toBe(claims.exp * 1000)
  })

  it('a falha do login não manda WWW-Authenticate, que é do token ausente', async () => {
    const response = await login('vera@axis.test', 'senha-errada')

    expect(response.headers['www-authenticate']).toBeUndefined()
  })

  it('guarda a senha com argon2, nunca em claro', async () => {
    const [row] = await testDb.db.select().from(users).where(eq(users.email, 'vera@axis.test'))

    expect(row?.passwordHash).toMatch(/^\$argon2id\$/)
    expect(row?.passwordHash).not.toContain(PASSWORD)
  })

  it('recusa corpo sem senha com 422', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { identifier: 'vera@axis.test' },
    })

    expect(response.statusCode).toBe(422)
    expect(problemaSchema.parse(response.json()).codigo).toBe('VALIDACAO')
  })

  describe('credenciais inválidas', () => {
    async function problemOf(identifier: string, password = PASSWORD) {
      const response = await login(identifier, password)
      expect(response.statusCode).toBe(401)
      expect(response.headers['content-type']).toContain('application/problem+json')
      return problemaSchema.parse(response.json())
    }

    it('senha errada responde 401 CREDENCIAIS_INVALIDAS', async () => {
      expect(await problemOf('vera@axis.test', 'senha-errada')).toMatchObject({
        status: 401,
        codigo: 'CREDENCIAIS_INVALIDAS',
      })
    })

    it('não revela se o e-mail ou a matrícula existe', async () => {
      const wrongPassword = await problemOf('vera@axis.test', 'senha-errada')

      expect(await problemOf('ninguem@axis.test')).toEqual(wrongPassword)
      expect(await problemOf('0000')).toEqual(wrongPassword)
    })

    it('conta desativada não entra, e a resposta é a mesma da senha errada', async () => {
      await createUser(testDb.db, {
        name: 'Inês Inativa',
        email: 'ines@axis.test',
        registration: '4001',
        password: PASSWORD,
        role: 'director',
        active: false,
      })

      const wrongPassword = await problemOf('vera@axis.test', 'senha-errada')

      expect(await problemOf('ines@axis.test')).toEqual(wrongPassword)
    })
  })
})

describe('GET /v1/me', () => {
  it('devolve o perfil de quem está logado, com o perfil de acesso', async () => {
    const response = await me(await loginToken('carla@axis.test'))

    expect(response.statusCode).toBe(200)
    expect(userSchema.parse(response.json())).toMatchObject({
      name: 'Carla Coordenadora',
      role: 'coordinator',
      coordinatorId: null,
    })
  })

  it.each([
    ['seller', 'vera@axis.test'],
    ['coordinator', 'carla@axis.test'],
    ['director', 'davi@axis.test'],
    ['administrator', 'ana@axis.test'],
  ])('informa o perfil %s', async (role, email) => {
    const response = await me(await loginToken(email))

    expect(response.statusCode).toBe(200)
    expect(userSchema.parse(response.json()).role).toBe(role)
  })

  it('token de um id que não é UUID responde 401, não 500', async () => {
    const response = await me(await signTestToken('não-sou-uuid'))

    expect(response.statusCode).toBe(401)
  })

  it('sem token responde 401 NAO_AUTENTICADO em Problem Details', async () => {
    const response = await me()

    expect(response.statusCode).toBe(401)
    expect(response.headers['content-type']).toContain('application/problem+json')
    expect(response.headers['www-authenticate']).toBe('Bearer')
    expect(problemaSchema.parse(response.json()).codigo).toBe('NAO_AUTENTICADO')
  })

  it('autentica antes de validar o corpo: sem token é 401, com token é 422', async () => {
    const send = (headers: Record<string, string>) =>
      app.inject({ method: 'POST', url: '/protected-echo', headers, payload: { name: 'ab' } })

    expect((await send({})).statusCode).toBe(401)
    const token = await loginToken('vera@axis.test')
    expect((await send({ authorization: `Bearer ${token}` })).statusCode).toBe(422)
  })

  it('token malformado responde 401', async () => {
    const response = await me('isto-nao-e-um-jwt')

    expect(response.statusCode).toBe(401)
    expect(problemaSchema.parse(response.json()).codigo).toBe('NAO_AUTENTICADO')
  })

  it('cabeçalho que não é Bearer responde 401', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: `Basic ${await loginToken('vera@axis.test')}` },
    })

    expect(response.statusCode).toBe(401)
  })

  it('token vencido responde 401', async () => {
    const response = await me(
      await signTestToken(await userIdOf('vera@axis.test'), { expiresInMs: -1000 }),
    )

    expect(response.statusCode).toBe(401)
    expect(problemaSchema.parse(response.json()).codigo).toBe('NAO_AUTENTICADO')
  })

  it('token assinado com outro segredo responde 401', async () => {
    const response = await me(
      await signTestToken(await userIdOf('vera@axis.test'), {
        secret: 'outro-segredo-com-mais-de-32-caracteres',
      }),
    )

    expect(response.statusCode).toBe(401)
  })

  it('conta desativada perde o acesso na hora, mesmo com o token ainda válido', async () => {
    await createUser(testDb.db, {
      name: 'Dora Desligada',
      email: 'dora@axis.test',
      registration: '5001',
      password: PASSWORD,
      role: 'coordinator',
    })
    const token = await loginToken('dora@axis.test')
    expect((await me(token)).statusCode).toBe(200)

    await testDb.db.update(users).set({ active: false }).where(eq(users.email, 'dora@axis.test'))

    const response = await me(token)
    expect(response.statusCode).toBe(401)
    expect(problemaSchema.parse(response.json()).codigo).toBe('NAO_AUTENTICADO')
  })
})
