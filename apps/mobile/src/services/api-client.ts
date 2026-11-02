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
  method?: 'GET' | 'POST'
  body?: unknown
  /** Padrão `true`: anexa o token e trata 401 como sessão vencida. O login passa `false`. */
  authenticated?: boolean
  /** Prazo da chamada inteira, inclusive a leitura da resposta. Sem valor, espera sem limite. */
  timeoutMs?: number
}

export type ApiClientDeps = {
  fetch?: typeof fetch
  getBaseUrl: () => Promise<string>
  getToken: () => Promise<string | null>
  /**
   * Chamado quando uma chamada autenticada recebe 401 (token vencido ou inválido), com o token
   * que foi enviado (`null` se não havia). Quem recebe compara com a sessão atual: um 401 tardio
   * de um token antigo não pode derrubar uma sessão nova.
   */
  onUnauthorized: (token: string | null) => void
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

function problemMessage(problem: ProblemBody, status: number): string {
  if (typeof problem.detail === 'string') return problem.detail
  if (typeof problem.title === 'string') return problem.title
  return `Erro ${status}`
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
      const token = authenticated ? await getToken() : null
      if (token) headers.Authorization = `Bearer ${token}`
      const url = `${await getBaseUrl()}${path}`

      const controller = new AbortController()

      async function exchange(): Promise<T> {
        let response: Response
        try {
          response = await fetchImpl(url, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: controller.signal,
          })
        } catch {
          throw new NetworkError()
        }

        if (!response.ok) {
          if (response.status === 401 && authenticated) onUnauthorized(token)
          const problem = await readProblem(response)
          throw new ApiRequestError(
            response.status,
            typeof problem.codigo === 'string' ? problem.codigo : undefined,
            problemMessage(problem, response.status),
          )
        }
        return (await response.json()) as T
      }

      if (timeoutMs === undefined) return exchange()

      // O prazo vale para a chamada inteira, inclusive a leitura do corpo da resposta.
      let timer: ReturnType<typeof setTimeout> | undefined
      const deadline = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          reject(new RequestTimeoutError())
        }, timeoutMs)
      })
      try {
        return await Promise.race([exchange(), deadline])
      } finally {
        clearTimeout(timer)
      }
    },
  }
}
