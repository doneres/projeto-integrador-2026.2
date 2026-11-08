import { sessionSchema } from '@axis/contracts'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TEST_JWT_SECRET } from '../../test/support/config'
import { createTestDatabase, type TestDatabase } from '../../test/support/database'
import { buildApp } from '../app'
import { systemSettings, users } from '../db/schema'
import { createUser } from '../users/create-user'
import { seedBase } from './base'
import { loadDatabaseTarget, loadSeedPasswords } from './env'

const passwords = loadSeedPasswords(
  {
    SEED_PASSWORD_SELLER: 'senha-teste-do-vendedor',
    SEED_PASSWORD_COORDINATOR: 'senha-teste-do-coordenador',
    SEED_PASSWORD_DIRECTOR: 'senha-teste-do-diretor',
    SEED_PASSWORD_ADMINISTRATOR: 'senha-teste-do-administrador',
  },
  loadDatabaseTarget({ DATABASE_URL_UNPOOLED: 'postgres://axis:axis@localhost:5432/axis' }),
)

let testDb: TestDatabase
let app: Awaited<ReturnType<typeof buildApp>>

beforeAll(async () => {
  testDb = await createTestDatabase()
  app = await buildApp({
    db: testDb.db,
    auth: { jwtSecret: TEST_JWT_SECRET, loginRateLimit: { max: 10_000, windowMs: 60_000 } },
  })
  await seedBase(testDb.db, passwords)
})
afterAll(async () => {
  await app.close()
  await testDb.drop()
})

function login(identifier: string, password: string) {
  return app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { identifier, password },
  })
}

describe('seedBase', () => {
  it.each([
    ['vendedor@axis.example', '2001', 'seller', passwords.seller],
    ['gestor@axis.example', '1001', 'coordinator', passwords.coordinator],
    ['diretor@axis.example', '3001', 'director', passwords.director],
    ['administrador@axis.example', '4001', 'administrator', passwords.administrator],
  ])(
    '%s entra por e-mail e por matrícula com a senha do seu perfil',
    async (email, registration, role, password) => {
      for (const identifier of [email, registration]) {
        const response = await login(identifier, password)
        expect(response.statusCode).toBe(200)
        expect(sessionSchema.parse(response.json()).user).toMatchObject({
          email,
          registration,
          role,
        })
      }
    },
  )

  it('cada perfil tem a sua senha: a de outro perfil não entra', async () => {
    const response = await login('gestor@axis.example', passwords.seller)
    expect(response.statusCode).toBe(401)
  })

  it('o Vendedor pertence à Equipe do Coordenador', async () => {
    const coordinator = sessionSchema.parse(
      (await login('1001', passwords.coordinator)).json(),
    ).user
    const seller = sessionSchema.parse((await login('2001', passwords.seller)).json()).user
    expect(seller.coordinatorId).toBe(coordinator.id)
  })

  it('cria os Parâmetros do sistema com os padrões', async () => {
    expect(await testDb.db.select().from(systemSettings)).toMatchObject([
      {
        checkinRadiusMeters: 100,
        scoreWeightRevenue: 50,
        scoreWeightVisits: 30,
        scoreWeightNewCustomers: 20,
      },
    ])
  })

  it('recusa, dizendo qual, uma matrícula já usada por conta de outro perfil', async () => {
    const other = await createTestDatabase()
    try {
      await createUser(other.db, {
        name: 'Outra pessoa',
        email: 'outra@axis.test',
        registration: '1001',
        password: 'senha-do-teste',
        role: 'director',
      })

      await expect(seedBase(other.db, passwords)).rejects.toThrow(/gestor@axis\.example.*director/)
    } finally {
      await other.drop()
    }
  })

  describe('rodando de novo', () => {
    it('não duplica nada e as contas continuam entrando', async () => {
      await seedBase(testDb.db, passwords)

      expect(await testDb.db.$count(users)).toBe(4)
      expect(await testDb.db.$count(systemSettings)).toBe(1)
      expect((await login('2001', passwords.seller)).statusCode).toBe(200)
    })

    it('preserva o que já foi ajustado: raio, senha e conta desativada', async () => {
      await testDb.db.update(systemSettings).set({ checkinRadiusMeters: 250 })
      await testDb.db.update(users).set({ active: false }).where(eq(users.registration, '3001'))

      await seedBase(testDb.db, { ...passwords, seller: 'outra-senha-do-vendedor' })

      const [settings] = await testDb.db.select().from(systemSettings)
      expect(settings?.checkinRadiusMeters).toBe(250)
      expect((await login('2001', passwords.seller)).statusCode).toBe(200)
      expect((await login('3001', passwords.director)).statusCode).toBe(401)
    })

    it('completa o que faltava, como o Administrador apagado à mão', async () => {
      await testDb.db.delete(users).where(eq(users.registration, '4001'))
      await testDb.db.delete(systemSettings)

      await seedBase(testDb.db, passwords)

      expect((await login('4001', passwords.administrator)).statusCode).toBe(200)
      expect(await testDb.db.$count(systemSettings)).toBe(1)
    })
  })
})
