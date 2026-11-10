import {
  type Customer,
  customerSchema,
  pageOf,
  type Route,
  type RouteDetail,
  routeDetailSchema,
  routeSchema,
  sessionSchema,
} from '@axis/contracts'
import { expect } from 'vitest'
import { buildApp } from '../../src/app'
import { seedDemo } from '../../src/seed/demo'
import { loadDatabaseTarget, loadSeedPasswords } from '../../src/seed/env'
import { TEST_JWT_SECRET } from './config'
import { createTestDatabase } from './database'

// Banco e API de teste para o seed demo, com o relógio sob controle do teste. Usado pelos testes
// da massa (#65) e do histórico (#66).

export const passwords = loadSeedPasswords(
  {
    SEED_PASSWORD_SELLER: 'senha-teste-do-vendedor',
    SEED_PASSWORD_COORDINATOR: 'senha-teste-do-coordenador',
    SEED_PASSWORD_DIRECTOR: 'senha-teste-do-diretor',
    SEED_PASSWORD_ADMINISTRATOR: 'senha-teste-do-administrador',
  },
  loadDatabaseTarget({ DATABASE_URL_UNPOOLED: 'postgres://axis:axis@localhost:5432/axis' }),
)

const customerPage = pageOf(customerSchema)
const routePage = pageOf(routeSchema)

/** Um banco e uma API de teste, com o relógio dos dois sob controle do teste. */
export async function harness(initialClock: Date) {
  const testDb = await createTestDatabase()
  const state = { clock: initialClock }
  const app = await buildApp({
    db: testDb.db,
    auth: { jwtSecret: TEST_JWT_SECRET, loginRateLimit: { max: 10_000, windowMs: 60_000 } },
    now: () => state.clock,
  })

  const login = (identifier: string, password: string) =>
    app.inject({ method: 'POST', url: '/v1/auth/login', payload: { identifier, password } })

  const asRole = {
    '1001': passwords.coordinator,
    '1002': passwords.coordinator,
    '3001': passwords.director,
    '4001': passwords.administrator,
  } as Record<string, string>

  const sessionOf = async (registration: string) => {
    const response = await login(registration, asRole[registration] ?? passwords.seller)
    expect(response.statusCode, `login de ${registration}`).toBe(200)
    return sessionSchema.parse(response.json())
  }

  const get = async (registration: string, url: string) => {
    const { token } = await sessionOf(registration)
    return app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${token}` } })
  }

  const customersOf = async (registration: string): Promise<Customer[]> => {
    const response = await get(registration, '/v1/customers?perPage=100')
    expect(response.statusCode).toBe(200)
    return customerPage.parse(response.json()).items
  }

  const routesOf = async (registration: string, date: string): Promise<Route[]> => {
    const response = await get(registration, `/v1/routes?date=${date}&perPage=100`)
    expect(response.statusCode).toBe(200)
    return routePage.parse(response.json()).items
  }

  const routeOn = async (registration: string, date: string): Promise<RouteDetail> => {
    const previous = state.clock
    state.clock = new Date(`${date}T15:00:00Z`)
    try {
      const response = await get(registration, '/v1/routes/today')
      expect(response.statusCode, `rota de ${registration} em ${date}`).toBe(200)
      return routeDetailSchema.parse(response.json())
    } finally {
      state.clock = previous
    }
  }

  return {
    ...testDb,
    app,
    state,
    login,
    sessionOf,
    get,
    customersOf,
    routesOf,
    routeOn,
    seed: (now: Date, demoLocation?: { latitude: number; longitude: number }) =>
      seedDemo(testDb.db, { passwords, now, demoLocation }),
    finish: async () => {
      await app.close()
      await testDb.drop()
    },
  }
}

export async function withHarness(clock: Date, run: (h: Harness) => Promise<void>) {
  const h = await harness(clock)
  try {
    await h.seed(clock)
    await run(h)
  } finally {
    await h.finish()
  }
}

export type Harness = Awaited<ReturnType<typeof harness>>
