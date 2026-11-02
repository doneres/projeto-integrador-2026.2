import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDatabase, type TestDatabase } from '../../test/support/database'
import { insertCustomer, insertRoute } from '../../test/support/factories'
import { createUser } from '../users/create-user'
import { routes, visits } from './schema'

// As regras de cliente, rota e visita que valem no próprio banco, para quem não passa pela API.

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

async function seedTeam(prefix: string) {
  const coordinator = await createUser(testDb.db, {
    ...base,
    email: `${prefix}-c@axis.test`,
    registration: `${prefix}-c`,
    role: 'coordinator',
  })
  const seller = await createUser(testDb.db, {
    ...base,
    email: `${prefix}-s@axis.test`,
    registration: `${prefix}-s`,
    role: 'seller',
    coordinatorId: coordinator.id,
  })
  return { coordinator, seller }
}

describe('cliente', () => {
  it('recusa o mesmo CPF/CNPJ em dois clientes, mas aceita de novo depois de uma rejeição', async () => {
    const { coordinator } = await seedTeam('cli')
    await insertCustomer(testDb.db, { coordinatorId: coordinator.id, document: '11111111000191' })

    expect(
      await violationOf(
        insertCustomer(testDb.db, { coordinatorId: coordinator.id, document: '11111111000191' }),
      ),
    ).toMatchObject({ code: '23505' })

    await insertCustomer(testDb.db, {
      coordinatorId: coordinator.id,
      document: '22222222000191',
      origin: 'prospect',
      status: 'rejected',
      rejectionReason: 'Duplicado',
    })
    await expect(
      insertCustomer(testDb.db, { coordinatorId: coordinator.id, document: '22222222000191' }),
    ).resolves.toBeDefined()
  })

  it('recusa coordenadas fora do mundo', async () => {
    const { coordinator } = await seedTeam('cli3')
    expect(
      await violationOf(insertCustomer(testDb.db, { coordinatorId: coordinator.id, latitude: 91 })),
    ).toMatchObject({ code: '23514' })
  })

  it('recusa cliente de carteira pendente de aprovação', async () => {
    const { coordinator } = await seedTeam('cli4')
    expect(
      await violationOf(
        insertCustomer(testDb.db, { coordinatorId: coordinator.id, status: 'pending_approval' }),
      ),
    ).toMatchObject({ code: '23514' })
  })
})

describe('rota e visita', () => {
  it('recusa duas rotas do mesmo vendedor no mesmo dia', async () => {
    const { coordinator, seller } = await seedTeam('rot')
    const customer = await insertCustomer(testDb.db, { coordinatorId: coordinator.id })
    const input = {
      sellerId: seller.id,
      createdById: coordinator.id,
      date: '2026-11-03',
      visits: [{ customerId: customer.id }],
    }
    await insertRoute(testDb.db, input)

    expect(await violationOf(insertRoute(testDb.db, input))).toMatchObject({ code: '23505' })
  })

  it('recusa o mesmo cliente duas vezes na rota', async () => {
    const { coordinator, seller } = await seedTeam('rot2')
    const customer = await insertCustomer(testDb.db, { coordinatorId: coordinator.id })

    expect(
      await violationOf(
        insertRoute(testDb.db, {
          sellerId: seller.id,
          createdById: coordinator.id,
          date: '2026-11-04',
          visits: [{ customerId: customer.id }, { customerId: customer.id }],
        }),
      ),
    ).toMatchObject({ code: '23505' })
  })

  it('recusa check-out sem check-in e check-in sem a leitura do GPS', async () => {
    const { coordinator, seller } = await seedTeam('vis')
    const customer = await insertCustomer(testDb.db, { coordinatorId: coordinator.id })
    const { visits: created } = await insertRoute(testDb.db, {
      sellerId: seller.id,
      createdById: coordinator.id,
      date: '2026-11-05',
      visits: [{ customerId: customer.id }],
    })
    const visitId = created[0]?.id as string

    expect(
      await violationOf(
        testDb.db
          .update(visits)
          .set({ checkedOutAt: new Date(), outcome: 'sale_made' })
          .where(eq(visits.id, visitId)),
      ),
    ).toMatchObject({ code: '23514' })
    expect(
      await violationOf(
        testDb.db.update(visits).set({ checkedInAt: new Date() }).where(eq(visits.id, visitId)),
      ),
    ).toMatchObject({ code: '23514' })
  })

  it('exige justificativa para desfecho não realizado e para check-in fora do raio', async () => {
    const { coordinator, seller } = await seedTeam('vis2')
    const customer = await insertCustomer(testDb.db, { coordinatorId: coordinator.id })
    const { visits: created } = await insertRoute(testDb.db, {
      sellerId: seller.id,
      createdById: coordinator.id,
      date: '2026-11-06',
      visits: [{ customerId: customer.id, checkedInAt: new Date() }],
    })
    const visitId = created[0]?.id as string

    expect(
      await violationOf(
        testDb.db
          .update(visits)
          .set({ checkedOutAt: new Date(), outcome: 'customer_closed' })
          .where(eq(visits.id, visitId)),
      ),
    ).toMatchObject({ code: '23514' })
    expect(
      await violationOf(
        testDb.db
          .update(visits)
          .set({ checkInStatus: 'out_of_radius' })
          .where(eq(visits.id, visitId)),
      ),
    ).toMatchObject({ code: '23514' })
  })

  it('apagar a rota leva as visitas junto', async () => {
    const { coordinator, seller } = await seedTeam('vis3')
    const customer = await insertCustomer(testDb.db, { coordinatorId: coordinator.id })
    const { route } = await insertRoute(testDb.db, {
      sellerId: seller.id,
      createdById: coordinator.id,
      date: '2026-11-07',
      visits: [{ customerId: customer.id }],
    })

    await testDb.db.delete(routes).where(eq(routes.id, route.id))

    expect(await testDb.db.select().from(visits).where(eq(visits.routeId, route.id))).toEqual([])
  })
})
