import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export type Database = PostgresJsDatabase<typeof schema>

export type DatabaseConnection = {
  db: Database
  /** Encerra as conexões abertas. */
  close: () => Promise<void>
}

/** Abre o pool de conexões. Não conecta até a primeira consulta. */
export function createDatabase(url: string): DatabaseConnection {
  const sql = postgres(url)
  return { db: drizzle(sql, { schema, casing: 'snake_case' }), close: () => sql.end() }
}
