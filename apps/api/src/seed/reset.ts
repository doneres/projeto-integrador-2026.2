import { sql } from 'drizzle-orm'
import type { Database } from '../db/client'
import type { DatabaseTarget } from './env'

/** Reset em production sem a confirmação do host de destino. */
export class ResetRefusedError extends Error {
  constructor(host: string) {
    super(
      `Reset recusado: o banco em ${host} é tratado como production e isto apaga todos os dados.\n` +
        `Para confirmar: pnpm --filter @axis/api db:reset --confirm=${host}`,
    )
    this.name = 'ResetRefusedError'
  }
}

type ResetOptions = {
  /** Em production, tem de ser o host de destino: confirmar é dizer qual banco vai ser zerado. */
  confirmHost?: string | undefined
  log?: (line: string) => void
}

/**
 * Apaga os dados de todas as tabelas de `public`, inclusive as que ainda vão surgir. O schema e o
 * histórico das migrations (schema `drizzle`) ficam, então a API e o seed seguem funcionando.
 */
export async function resetDatabase(
  db: Database,
  target: DatabaseTarget,
  { confirmHost, log }: ResetOptions = {},
): Promise<void> {
  if (target.production && confirmHost !== target.host) {
    throw new ResetRefusedError(target.host)
  }
  log?.(`Zerando o banco em ${target.host}...`)

  const tables = await db.execute<{ name: string }>(
    sql`SELECT quote_ident(tablename) AS name FROM pg_tables WHERE schemaname = 'public'`,
  )
  if (tables.length > 0) {
    await db.execute(sql.raw(`TRUNCATE ${tables.map(({ name }) => name).join(', ')}`))
  }
}
