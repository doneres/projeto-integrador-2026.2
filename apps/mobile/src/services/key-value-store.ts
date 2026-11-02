import * as SecureStore from 'expo-secure-store'

/** Armazenamento chave-valor assíncrono do aparelho. */
export type KeyValueStore = {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

/** Armazenamento seguro do aparelho (Keychain no iOS, Keystore no Android). Guarda o token. */
export const secureStore: KeyValueStore = {
  get: (key) => SecureStore.getItemAsync(key),
  set: (key, value) => SecureStore.setItemAsync(key, value),
  remove: (key) => SecureStore.deleteItemAsync(key),
}
