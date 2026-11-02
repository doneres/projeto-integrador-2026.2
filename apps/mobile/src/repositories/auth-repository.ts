import { type LoginBody, type Session, sessionSchema } from '@axis/contracts'
import type { ApiClient } from '@/services/api-client'

/** O Render Free dorme em 15 min e leva cerca de um minuto para acordar: o login espera até 90 s. */
export const LOGIN_TIMEOUT_MS = 90_000

export type AuthRepository = {
  login(body: LoginBody): Promise<Session>
}

export function createAuthRepository(api: Pick<ApiClient, 'request'>): AuthRepository {
  return {
    async login(body) {
      const response = await api.request('/v1/auth/login', {
        method: 'POST',
        body,
        authenticated: false,
        timeoutMs: LOGIN_TIMEOUT_MS,
      })
      return sessionSchema.parse(response)
    },
  }
}
