import { ApiRequestError, createApiClient, NetworkError, RequestTimeoutError } from './api-client'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' },
  })
}

function setup(fetchImpl: jest.Mock, token: string | null = 'jwt-123') {
  const onUnauthorized = jest.fn()
  const client = createApiClient({
    fetch: fetchImpl as unknown as typeof fetch,
    getBaseUrl: async () => 'http://api.test',
    getToken: async () => token,
    onUnauthorized,
  })
  return { client, onUnauthorized }
}

describe('createApiClient', () => {
  it('envia JSON para a URL base e devolve o corpo da resposta', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(200, { ok: true }))
    const { client } = setup(fetchImpl)

    await expect(client.request('/v1/x', { method: 'POST', body: { a: 1 } })).resolves.toEqual({
      ok: true,
    })

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('http://api.test/v1/x')
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"a":1}')
    expect(init.headers['Content-Type']).toBe('application/json')
  })

  it('anexa o token da sessão como Bearer', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(200, {}))
    const { client } = setup(fetchImpl)
    await client.request('/v1/me')
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt-123')
  })

  it('não anexa token quando a chamada é pública', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(200, {}))
    const { client } = setup(fetchImpl)
    await client.request('/v1/auth/login', { method: 'POST', body: {}, authenticated: false })
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBeUndefined()
  })

  it('erro da API vira ApiRequestError com status, código e mensagem do problema', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(401, {
        status: 401,
        title: 'Não autenticado',
        detail: 'E-mail, matrícula ou senha incorretos',
        codigo: 'CREDENCIAIS_INVALIDAS',
      }),
    )
    const { client } = setup(fetchImpl)

    const error = await client
      .request('/v1/auth/login', { method: 'POST', body: {}, authenticated: false })
      .catch((e) => e)

    expect(error).toBeInstanceOf(ApiRequestError)
    expect(error).toMatchObject({
      status: 401,
      code: 'CREDENCIAIS_INVALIDAS',
      message: 'E-mail, matrícula ou senha incorretos',
    })
  })

  it('401 em chamada autenticada avisa que a sessão acabou', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(401, { status: 401, title: 'x' }))
    const { client, onUnauthorized } = setup(fetchImpl)
    await expect(client.request('/v1/me')).rejects.toBeInstanceOf(ApiRequestError)
    // Leva o token usado na chamada: quem recebe descarta o aviso de um token que já saiu de cena.
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(onUnauthorized).toHaveBeenCalledWith('jwt-123')
  })

  it('401 do login (credenciais erradas) não derruba sessão nenhuma', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(401, { status: 401, title: 'x' }))
    const { client, onUnauthorized } = setup(fetchImpl)
    await client
      .request('/v1/auth/login', { method: 'POST', body: {}, authenticated: false })
      .catch(() => undefined)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('resposta de erro sem corpo JSON ainda vira ApiRequestError', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(new Response('<html>bad gateway</html>', { status: 502 }))
    const { client } = setup(fetchImpl)
    await expect(client.request('/v1/x')).rejects.toMatchObject({ status: 502, code: undefined })
  })

  it('falha de rede vira NetworkError', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError('Network request failed'))
    const { client } = setup(fetchImpl)
    await expect(client.request('/v1/x')).rejects.toBeInstanceOf(NetworkError)
  })

  describe('timeout', () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())

    // fetch que só termina quando o AbortSignal dispara, como o de verdade.
    function hangingFetch() {
      return jest.fn(
        (_url: string, init: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            )
          }),
      )
    }

    it('aborta a chamada que passa de timeoutMs e lança RequestTimeoutError', async () => {
      const { client } = setup(hangingFetch())
      let outcome: unknown
      client.request('/v1/x', { timeoutMs: 90_000 }).catch((e) => {
        outcome = e
      })

      await jest.advanceTimersByTimeAsync(89_999)
      expect(outcome).toBeUndefined()

      await jest.advanceTimersByTimeAsync(1)
      expect(outcome).toBeInstanceOf(RequestTimeoutError)
    })

    it('o prazo também vale para a leitura do corpo da resposta', async () => {
      const stuckBody = { ok: true, status: 200, json: () => new Promise(() => undefined) }
      const { client } = setup(jest.fn().mockResolvedValue(stuckBody))
      let outcome: unknown
      client.request('/v1/x', { timeoutMs: 90_000 }).catch((e) => {
        outcome = e
      })

      await jest.advanceTimersByTimeAsync(89_999)
      expect(outcome).toBeUndefined()

      await jest.advanceTimersByTimeAsync(1)
      expect(outcome).toBeInstanceOf(RequestTimeoutError)
    })
  })
})
