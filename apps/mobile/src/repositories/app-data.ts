import { type ApiClient, createApiClient } from '@/services/api-client'
import { type ApiUrlSettings, createApiUrlSettings } from '@/services/api-url'
import { getEnv } from '@/services/env'
import { type KeyValueStore, secureStore } from '@/services/key-value-store'
import { type AuthRepository, createAuthRepository } from './auth-repository'
import { createSessionRepository, type SessionRepository } from './session-repository'

/** Tudo que as telas precisam do mundo de fora: API, sessão guardada e URL da API. */
export type AppData = {
  api: ApiClient
  auth: AuthRepository
  sessions: SessionRepository
  apiUrl: ApiUrlSettings
  /** Avisa quando a API recusa o token (401). Devolve a função que cancela o aviso. */
  onUnauthorized(listener: () => void): () => void
}

type Deps = {
  store: KeyValueStore
  fetch?: typeof fetch
  envApiUrl: () => string
}

export function createAppData({ store, fetch, envApiUrl }: Deps): AppData {
  const sessions = createSessionRepository(store)
  const apiUrl = createApiUrlSettings(store, envApiUrl)
  const listeners = new Set<() => void>()
  const api = createApiClient({
    fetch,
    getBaseUrl: () => apiUrl.resolve(),
    getToken: async () => (await sessions.load())?.token ?? null,
    onUnauthorized: () => {
      for (const listener of [...listeners]) listener()
    },
  })
  return {
    api,
    auth: createAuthRepository(api),
    sessions,
    apiUrl,
    onUnauthorized(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

let shared: AppData | undefined

/** Instância do app: armazenamento seguro do aparelho e URL do ambiente do build. */
export function getAppData(): AppData {
  shared ??= createAppData({ store: secureStore, envApiUrl: () => getEnv().apiUrl })
  return shared
}
