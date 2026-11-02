import { type Session, sessionSchema } from '@axis/contracts'
import type { KeyValueStore } from '@/services/key-value-store'

const STORAGE_KEY = 'axis.session'

export type SessionRepository = {
  /** Sessão guardada ainda dentro da validade, ou `null`. Sessão vencida ou corrompida é apagada. */
  load(): Promise<Session | null>
  save(session: Session): Promise<void>
  clear(): Promise<void>
}

/** Sessão do Vendedor no armazenamento seguro do aparelho. O token vale 8 h, sem refresh. */
export function createSessionRepository(
  store: KeyValueStore,
  now: () => Date = () => new Date(),
): SessionRepository {
  return {
    async load() {
      const raw = await store.get(STORAGE_KEY)
      if (raw === null) return null
      let parsed: ReturnType<typeof sessionSchema.safeParse>
      try {
        parsed = sessionSchema.safeParse(JSON.parse(raw))
      } catch {
        parsed = sessionSchema.safeParse(undefined)
      }
      if (!parsed.success || new Date(parsed.data.expiresAt) <= now()) {
        await store.remove(STORAGE_KEY)
        return null
      }
      return parsed.data
    },
    save: (session) => store.set(STORAGE_KEY, JSON.stringify(session)),
    clear: () => store.remove(STORAGE_KEY),
  }
}
