export type LoginRateLimit = {
  /** Tentativas de login por endereço dentro da janela. */
  max: number
  windowMs: number
}

export type AuthOptions = {
  /** Segredo que assina os JWT (HS256). */
  jwtSecret: string
  /** Padrão: 30 tentativas por minuto por endereço. */
  loginRateLimit?: LoginRateLimit
}

export const DEFAULT_LOGIN_RATE_LIMIT: LoginRateLimit = { max: 30, windowMs: 60_000 }
