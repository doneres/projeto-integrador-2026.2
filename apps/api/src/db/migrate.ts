import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

/**
 * Aplica as migrations pendentes. Passe a URL direta do banco (sem pooler): o migrator usa
 * lock e DDL em sessão, que um pooler em modo transação não garante.
 */
export async function runMigrations(url: string, migrationsFolder: string): Promise<void> {
  const sql = postgres(url, { max: 1 })
  try {
    await migrate(drizzle(sql), { migrationsFolder })
  } finally {
    await sql.end()
  }
}
