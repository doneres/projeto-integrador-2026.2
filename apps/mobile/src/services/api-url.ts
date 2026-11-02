import { parseApiUrl } from './env'
import type { KeyValueStore } from './key-value-store'

const STORAGE_KEY = 'axis.apiUrl'

export class InvalidApiUrlError extends Error {
  constructor() {
    super('Informe uma URL completa, como https://axis-api.onrender.com')
    this.name = 'InvalidApiUrlError'
  }
}

/** Não há URL guardada no aparelho nem no ambiente do build. */
export class ApiUrlMissingError extends Error {
  constructor() {
    super('A URL da API não está configurada')
    this.name = 'ApiUrlMissingError'
  }
}

/** `http://` leva e-mail, matrícula e senha sem criptografia. */
export function isInsecureApiUrl(url: string): boolean {
  return url.trim().toLowerCase().startsWith('http://')
}

export type ApiUrlSettings = {
  /** URL em uso: a guardada no aparelho, ou a do ambiente do build. */
  resolve(): Promise<string>
  getOverride(): Promise<string | null>
  /** Valida e guarda a URL (sem barra final). */
  setOverride(url: string): Promise<string>
  clearOverride(): Promise<void>
}

/** A URL da API pode ser trocada dentro do app (útil quando o IP da máquina muda ou a API sobe no Render). */
export function createApiUrlSettings(
  store: KeyValueStore,
  envApiUrl: () => string,
): ApiUrlSettings {
  return {
    async resolve() {
      const stored = await store.get(STORAGE_KEY)
      if (stored !== null) return stored
      try {
        return envApiUrl()
      } catch {
        throw new ApiUrlMissingError()
      }
    },
    getOverride: () => store.get(STORAGE_KEY),
    async setOverride(url) {
      const parsed = parseApiUrl(url)
      if (!parsed) throw new InvalidApiUrlError()
      await store.set(STORAGE_KEY, parsed)
      return parsed
    },
    clearOverride: () => store.remove(STORAGE_KEY),
  }
}
