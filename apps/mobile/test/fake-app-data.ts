import type { Session } from '@axis/contracts'
import { type AppData, createAppData, createUnauthorizedBus } from '@/repositories/app-data'
import type { AuthRepository } from '@/repositories/auth-repository'
import type { RouteRepository } from '@/repositories/route-repository'
import type { Connectivity } from '@/services/connectivity'
import { createMemoryStore } from './memory-store'

/** Sessão de Vendedor válida para os testes. */
export function sellerSession(overrides: Partial<Session['user']> = {}): Session {
  return {
    token: 'jwt-123',
    expiresAt: '2099-11-02T20:00:00.000Z',
    user: {
      id: '0198f2a0-7c1e-7000-8000-000000000001',
      name: 'Ana Souza',
      email: 'ana@axis.test',
      registration: '2001',
      role: 'seller',
      coordinatorId: '0198f2a0-7c1e-7000-8000-000000000002',
      ...overrides,
      active: overrides.active ?? true,
    },
  }
}

export type FakeAppData = AppData & {
  /** Simula a API respondendo 401 a uma chamada feita com `token` (padrão: o de `sellerSession`). */
  emitUnauthorized(token?: string | null): void
}

export type FakeExtras = {
  connectivity?: Connectivity
  now?: () => Date
}

/**
 * Repositórios de verdade sobre armazenamento em memória; só o login, a rota, a rede e o relógio
 * podem ser falsos. Sem `connectivity`, o aparelho está sempre com rede.
 */
export function createFakeAppData(
  auth?: AuthRepository,
  routes?: RouteRepository,
  { connectivity = { isOnline: async () => true }, now }: FakeExtras = {},
): FakeAppData {
  const real = createAppData({
    store: createMemoryStore(),
    fetch: (() => Promise.reject(new Error('rede indisponível nos testes'))) as typeof fetch,
    envApiUrl: () => 'http://env.test',
    connectivity,
    now,
  })
  const unauthorized = createUnauthorizedBus()
  return {
    ...real,
    auth: auth ?? real.auth,
    routes: routes ?? real.routes,
    onUnauthorized: unauthorized.subscribe,
    emitUnauthorized: (token = sellerSession().token) => unauthorized.emit(token),
  }
}
