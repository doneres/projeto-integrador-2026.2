import type { Session } from '@axis/contracts'
import { type AppData, createAppData } from '@/repositories/app-data'
import type { AuthRepository } from '@/repositories/auth-repository'
import { createMemoryStore } from '@/services/key-value-store'

/** Sessão de Vendedor válida para os testes. */
export function sellerSession(overrides: Partial<Session['user']> = {}): Session {
  return {
    token: 'jwt-123',
    expiresAt: '2026-11-02T20:00:00.000Z',
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
  /** Simula a API respondendo 401 a uma chamada autenticada. */
  emitUnauthorized(): void
}

/** Repositórios de verdade sobre armazenamento em memória; só o login é falso. */
export function createFakeAppData(auth?: AuthRepository): FakeAppData {
  const real = createAppData({
    store: createMemoryStore(),
    fetch: (() => Promise.reject(new Error('rede indisponível nos testes'))) as typeof fetch,
    envApiUrl: () => 'http://env.test',
  })
  const listeners = new Set<() => void>()
  return {
    ...real,
    auth: auth ?? real.auth,
    onUnauthorized(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    emitUnauthorized() {
      for (const listener of [...listeners]) listener()
    },
  }
}
