import type { Session } from '@axis/contracts'
import { type AppData, createAppData, createUnauthorizedBus } from '@/repositories/app-data'
import type { AuthRepository } from '@/repositories/auth-repository'
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
    },
  }
}

export type FakeAppData = AppData & {
  /** Simula a API respondendo 401 a uma chamada feita com `token` (padrão: o de `sellerSession`). */
  emitUnauthorized(token?: string | null): void
}

/** Repositórios de verdade sobre armazenamento em memória; só o login é falso. */
export function createFakeAppData(auth?: AuthRepository): FakeAppData {
  const real = createAppData({
    store: createMemoryStore(),
    fetch: (() => Promise.reject(new Error('rede indisponível nos testes'))) as typeof fetch,
    envApiUrl: () => 'http://env.test',
  })
  const unauthorized = createUnauthorizedBus()
  return {
    ...real,
    auth: auth ?? real.auth,
    onUnauthorized: unauthorized.subscribe,
    emitUnauthorized: (token = sellerSession().token) => unauthorized.emit(token),
  }
}
