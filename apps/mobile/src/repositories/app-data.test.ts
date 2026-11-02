import type { Session } from '@axis/contracts'
import { createMemoryStore } from '@test/memory-store'
import { createAppData } from './app-data'

const session: Session = {
  token: 'jwt-123',
  expiresAt: '2099-01-01T00:00:00.000Z',
  user: {
    id: '0198f2a0-7c1e-7000-8000-000000000001',
    name: 'Ana Souza',
    email: 'ana@axis.test',
    registration: '2001',
    role: 'seller',
    coordinatorId: null,
  },
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status })
}

describe('createAppData', () => {
  it('o login usa a URL da API guardada no aparelho', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(200, session))
    const data = createAppData({
      store: createMemoryStore(),
      fetch: fetchImpl as unknown as typeof fetch,
      envApiUrl: () => 'http://env.test',
    })

    await data.apiUrl.setOverride('http://10.0.0.5:3000')
    await data.auth.login({ identifier: '2001', password: 'axis-demo-2026' })

    expect(fetchImpl.mock.calls[0][0]).toBe('http://10.0.0.5:3000/v1/auth/login')
  })

  it('um 401 numa chamada autenticada avisa os ouvintes de sessão vencida', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(401, { status: 401, title: 'x' }))
    const store = createMemoryStore()
    const data = createAppData({
      store,
      fetch: fetchImpl as unknown as typeof fetch,
      envApiUrl: () => 'http://env.test',
    })
    await data.sessions.save(session)
    const listener = jest.fn()
    data.onUnauthorized(listener)

    await data.api.request('/v1/me').catch(() => undefined)

    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt-123')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('quem deixou de ouvir não é mais avisado', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(401, { status: 401, title: 'x' }))
    const data = createAppData({
      store: createMemoryStore(),
      fetch: fetchImpl as unknown as typeof fetch,
      envApiUrl: () => 'http://env.test',
    })
    const listener = jest.fn()
    const stop = data.onUnauthorized(listener)
    stop()
    await data.api.request('/v1/me').catch(() => undefined)
    expect(listener).not.toHaveBeenCalled()
  })
})
