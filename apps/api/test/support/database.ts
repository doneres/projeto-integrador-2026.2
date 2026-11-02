import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { createDatabase, type Database } from '../../src/db/client'
import { TEMPLATE_DATABASE, TEST_DATABASE_PREFIX, TEST_SERVER_URL, urlForDatabase } from './config'

export type TestDatabase = {
  db: Database
  /** Fecha as conexões e apaga o banco. */
  drop: () => Promise<void>
}

/**
 * Cria um banco só para quem chamou, já migrado (cópia do banco modelo). Cada arquivo de teste
 * chama uma vez em `beforeAll`, então os arquivos rodam em paralelo sem enxergar os dados uns
 * dos outros.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const name = `${TEST_DATABASE_PREFIX}${randomUUID().replaceAll('-', '')}`
  const admin = postgres(TEST_SERVER_URL, { max: 1 })
  try {
    await admin.unsafe(`CREATE DATABASE "${name}" TEMPLATE "${TEMPLATE_DATABASE}"`)
  } finally {
    await admin.end()
  }
  const connection = createDatabase(urlForDatabase(TEST_SERVER_URL, name))
  return {
    db: connection.db,
    async drop() {
      await connection.close()
      const cleanup = postgres(TEST_SERVER_URL, { max: 1 })
      try {
        await cleanup.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
      } finally {
        await cleanup.end()
      }
    },
  }
}
