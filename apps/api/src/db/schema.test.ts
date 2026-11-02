import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDatabase, type TestDatabase } from '../../test/support/database'
import { createUser } from '../users/create-user'
import { users } from './schema'

let testDb: TestDatabase

beforeAll(async () => {
  testDb = await createTestDatabase()
})
afterAll(async () => {
  await testDb.drop()
})

/** O Drizzle embrulha o erro do Postgres em `cause`: devolve o erro de verdade. */
async function violationOf(query: PromiseLike<unknown>) {
  try {
    await query
  } catch (error) {
    return (error as { cause?: unknown }).cause ?? error
  }
  throw new Error('a consulta devia ter falhado')
}

const base = { name: 'Fulano', password: 'senha-do-teste' }

// Estas regras valem no próprio banco, para quem não passa por createUser (SQL direto, ajuste manual).
describe('regra do coordenador do vendedor', () => {
  it('o banco recusa apontar o vendedor para quem não é coordenador', async () => {
    const coordinator = await createUser(testDb.db, {
      ...base,
      email: 'c1@axis.test',
      registration: 'c1',
      role: 'coordinator',
    })
    const seller = await createUser(testDb.db, {
      ...base,
      email: 's1@axis.test',
      registration: 's1',
      role: 'seller',
      coordinatorId: coordinator.id,
    })
    const director = await createUser(testDb.db, {
      ...base,
      email: 'd1@axis.test',
      registration: 'd1',
      role: 'director',
    })

    expect(
      await violationOf(
        testDb.db.update(users).set({ coordinatorId: director.id }).where(eq(users.id, seller.id)),
      ),
    ).toMatchObject({
      code: '23514',
      message: expect.stringMatching(/deve apontar para um usuário com perfil coordinator/),
    })
  })

  it('o banco recusa inserir vendedor apontando para quem não é coordenador', async () => {
    const director = await createUser(testDb.db, {
      ...base,
      email: 'd2@axis.test',
      registration: 'd2',
      role: 'director',
    })
    const [template] = await testDb.db.select().from(users).where(eq(users.id, director.id))

    expect(
      await violationOf(
        testDb.db.insert(users).values({
          ...(template as typeof users.$inferInsert),
          id: '0192f4a0-0000-7000-8000-0000000000ff',
          email: 's9@axis.test',
          registration: 's9',
          role: 'seller',
          coordinatorId: director.id,
        }),
      ),
    ).toMatchObject({
      code: '23514',
      message: expect.stringMatching(/deve apontar para um usuário com perfil coordinator/),
    })
  })

  it('o banco recusa tirar o perfil de coordenador de quem tem vendedores', async () => {
    const coordinator = await createUser(testDb.db, {
      ...base,
      email: 'c2@axis.test',
      registration: 'c2',
      role: 'coordinator',
    })
    await createUser(testDb.db, {
      ...base,
      email: 's2@axis.test',
      registration: 's2',
      role: 'seller',
      coordinatorId: coordinator.id,
    })

    expect(
      await violationOf(
        testDb.db.update(users).set({ role: 'director' }).where(eq(users.id, coordinator.id)),
      ),
    ).toMatchObject({
      code: '23514',
      message: expect.stringMatching(/continuar com o perfil coordinator/),
    })
  })

  it('o coordenador sem vendedores pode mudar de perfil', async () => {
    const coordinator = await createUser(testDb.db, {
      ...base,
      email: 'c3@axis.test',
      registration: 'c3',
      role: 'coordinator',
    })

    await testDb.db.update(users).set({ role: 'director' }).where(eq(users.id, coordinator.id))

    const [row] = await testDb.db.select().from(users).where(eq(users.id, coordinator.id))
    expect(row?.role).toBe('director')
  })
})
