/** Erro devolvido pela API (Problem Details): status HTTP, código estável e mensagem. */
export class ApiRequestError extends Error {
  readonly status: number
  readonly code: string | undefined

  constructor(status: number, code: string | undefined, message: string) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
  }
}

/** Sem resposta do servidor: sem sinal, API fora do ar ou URL errada. */
export class NetworkError extends Error {
  constructor() {
    super('Sem conexão com o servidor')
    this.name = 'NetworkError'
  }
}

/** O servidor não respondeu dentro do prazo. */
export class RequestTimeoutError extends Error {
  constructor() {
    super('O servidor não respondeu a tempo')
    this.name = 'RequestTimeoutError'
  }
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Padrão `true`: anexa o token e trata 401 como sessão vencida. O login passa `false`. */
  authenticated?: boolean
  /** Sem valor, a chamada espera sem limite. */
  timeoutMs?: number
}

export type ApiClientDeps = {
  fetch?: typeof fetch
  getBaseUrl: () => Promise<string>
  getToken: () => Promise<string | null>
  /** Chamado quando uma chamada autenticada recebe 401 (token vencido ou inválido). */
  onUnauthorized: () => void
}

export type ApiClient = {
  request<T = unknown>(path: string, options?: RequestOptions): Promise<T>
}

type ProblemBody = { detail?: unknown; title?: unknown; codigo?: unknown }

async function readProblem(response: Response): Promise<ProblemBody> {
  try {
    const body: unknown = await response.json()
    return body && typeof body === 'object' ? (body as ProblemBody) : {}
  } catch {
    return {}
  }
}

export function createApiClient({
  fetch: fetchImpl = (...args) => fetch(...args),
  getBaseUrl,
  getToken,
  onUnauthorized,
}: ApiClientDeps): ApiClient {
  return {
    async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
      const { method = 'GET', body, authenticated = true, timeoutMs } = options
      const headers: Record<string, string> = { Accept: 'application/json' }
      if (body !== undefined) headers['Content-Type'] = 'application/json'
      if (authenticated) {
        const token = await getToken()
        if (token) headers.Authorization = `Bearer ${token}`
      }
      const url = `${await getBaseUrl()}${path}`

      const controller = new AbortController()
      let timedOut = false
      const timer =
        timeoutMs === undefined
          ? undefined
          : setTimeout(() => {
              timedOut = true
              controller.abort()
            }, timeoutMs)

      let response: Response
      try {
        response = await fetchImpl(url, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        })
      } catch {
        throw timedOut ? new RequestTimeoutError() : new NetworkError()
      } finally {
        if (timer !== undefined) clearTimeout(timer)
      }

      if (!response.ok) {
        if (response.status === 401 && authenticated) onUnauthorized()
        const problem = await readProblem(response)
        const message =
          typeof problem.detail === 'string'
            ? problem.detail
            : typeof problem.title === 'string'
              ? problem.title
              : `Erro ${response.status}`
        throw new ApiRequestError(
          response.status,
          typeof problem.codigo === 'string' ? problem.codigo : undefined,
          message,
        )
      }

      return (await response.json()) as T
    },
  }
}
