import type { KeyValueStore } from '@/services/key-value-store'

/** Armazenamento em memória, para testes. */
export function createMemoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const data = new Map(Object.entries(initial))
  return {
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => {
      data.set(key, value)
    },
    remove: async (key) => {
      data.delete(key)
    },
  }
}
