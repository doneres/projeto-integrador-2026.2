import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDatabase, type TestDatabase } from '../../test/support/database'
import { systemSettings } from './schema'

// As regras dos Parâmetros do sistema que valem no próprio banco, para quem não passa pela API.

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

const valid = {
  checkinRadiusMeters: 100,
  scoreWeightRevenue: 50,
  scoreWeightVisits: 30,
  scoreWeightNewCustomers: 20,
}

describe('Parâmetros do sistema', () => {
  it('o banco recusa pesos que não somam 100', async () => {
    expect(
      await violationOf(
        testDb.db.insert(systemSettings).values({ ...valid, scoreWeightRevenue: 51 }),
      ),
    ).toMatchObject({ code: '23514', constraint_name: 'system_settings_weights_sum_100' })
  })

  it('o banco recusa peso negativo, mesmo com a soma certa', async () => {
    expect(
      await violationOf(
        testDb.db.insert(systemSettings).values({
          ...valid,
          scoreWeightRevenue: 80,
          scoreWeightVisits: -10,
          scoreWeightNewCustomers: 30,
        }),
      ),
    ).toMatchObject({ code: '23514', constraint_name: 'system_settings_weights_not_negative' })
  })

  it('o banco recusa raio zero', async () => {
    expect(
      await violationOf(
        testDb.db.insert(systemSettings).values({ ...valid, checkinRadiusMeters: 0 }),
      ),
    ).toMatchObject({ code: '23514', constraint_name: 'system_settings_radius_positive' })
  })

  it('só existe uma linha', async () => {
    await testDb.db.insert(systemSettings).values(valid)

    expect(await violationOf(testDb.db.insert(systemSettings).values(valid))).toMatchObject({
      code: '23505',
    })
  })
})
