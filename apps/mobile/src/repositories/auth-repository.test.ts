import { ApiRequestError } from '@/services/api-client'
import { createAuthRepository, LOGIN_TIMEOUT_MS } from './auth-repository'

const validSession = {
  token: 'jwt-123',
  expiresAt: '2026-11-02T20:00:00.000Z',
  user: {
    id: '0198f2a0-7c1e-7000-8000-000000000001',
    name: 'Ana Souza',
    email: 'ana@axis.test',
    registration: '2001',
    role: 'seller',
    coordinatorId: null,
  },
}

describe('createAuthRepository', () => {
  it('POST /v1/auth/login sem token e com timeout de 90 s', async () => {
    const request = jest.fn().mockResolvedValue(validSession)
    const repository = createAuthRepository({ request })

    await expect(
      repository.login({ identifier: '2001', password: 'axis-demo-2026' }),
    ).resolves.toEqual(validSession)

    expect(LOGIN_TIMEOUT_MS).toBe(90_000)
    expect(request).toHaveBeenCalledWith('/v1/auth/login', {
      method: 'POST',
      body: { identifier: '2001', password: 'axis-demo-2026' },
      authenticated: false,
      timeoutMs: 90_000,
    })
  })

  it('repassa o erro da API', async () => {
    const error = new ApiRequestError(401, 'CREDENCIAIS_INVALIDAS', 'incorretos')
    const repository = createAuthRepository({ request: jest.fn().mockRejectedValue(error) })
    await expect(repository.login({ identifier: 'x', password: 'y' })).rejects.toBe(error)
  })

  it('recusa resposta fora do contrato', async () => {
    const repository = createAuthRepository({
      request: jest.fn().mockResolvedValue({ token: 'x' }),
    })
    await expect(repository.login({ identifier: 'x', password: 'y' })).rejects.toThrow()
  })
})
