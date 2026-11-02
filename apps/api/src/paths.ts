import { fileURLToPath } from 'node:url'

/**
 * Pasta das migrations (apps/api/drizzle). Fica na raiz de `src` de propósito: o build empacota
 * tudo em `dist/server.js`, e dos dois lugares a pasta está em `../drizzle`.
 */
export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../drizzle', import.meta.url))
