import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDatabase, type TestDatabase } from '../../test/support/database'
import { createUser, type NewUser } from './create-user'

let testDb: TestDatabase

beforeAll(async () => {
  testDb = await createTestDatabase()
})
afterAll(async () => {
  await testDb.drop()
})

const base = { name: 'Fulano', password: 'senha-do-teste' }

function newUser(overrides: Partial<NewUser> & Pick<NewUser, 'role' | 'registration'>): NewUser {
  return { ...base, email: `${overrides.registration}@axis.test`, ...overrides }
}

describe('createUser', () => {
  it('grava o e-mail em minúsculas', async () => {
    const created = await createUser(
      testDb.db,
      newUser({ role: 'director', registration: 'd1', email: 'Davi@AXIS.test ' }),
    )

    expect(created.email).toBe('davi@axis.test')
  })

  it('recusa matrícula com "@", que o login tomaria por e-mail', async () => {
    await expect(
      createUser(testDb.db, newUser({ role: 'director', registration: 'maria@axis.test' })),
    ).rejects.toThrow(/@/)
  })

  it('exige coordenador para o vendedor', async () => {
    await expect(
      createUser(testDb.db, newUser({ role: 'seller', registration: 's1' })),
    ).rejects.toThrow()
  })

  it('só aceita coordenador no vendedor', async () => {
    const coordinator = await createUser(
      testDb.db,
      newUser({ role: 'coordinator', registration: 'c1' }),
    )

    await expect(
      createUser(
        testDb.db,
        newUser({ role: 'director', registration: 'd2', coordinatorId: coordinator.id }),
      ),
    ).rejects.toThrow()
  })

  it('exige que o coordenador do vendedor seja mesmo um coordenador', async () => {
    const director = await createUser(testDb.db, newUser({ role: 'director', registration: 'd3' }))

    await expect(
      createUser(
        testDb.db,
        newUser({ role: 'seller', registration: 's2', coordinatorId: director.id }),
      ),
    ).rejects.toThrow(/coordinator/)
  })

  it('recusa e-mail e matrícula repetidos', async () => {
    await createUser(testDb.db, newUser({ role: 'director', registration: 'r1' }))

    await expect(
      createUser(
        testDb.db,
        newUser({ role: 'director', registration: 'r2', email: 'r1@axis.test' }),
      ),
    ).rejects.toThrow()
    await expect(
      createUser(
        testDb.db,
        newUser({ role: 'director', registration: 'r1', email: 'outro@axis.test' }),
      ),
    ).rejects.toThrow()
  })
})
