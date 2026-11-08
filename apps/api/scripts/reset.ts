// Zera o banco. Sem cerimônia em dev; em production exige --confirm=<host> (veja o README).
// Uso: pnpm --filter @axis/api db:reset [--confirm=<host>]
import { parseArgs } from 'node:util'
import { createDatabase } from '../src/db/client'
import { loadDatabaseTarget } from '../src/seed/env'
import { resetDatabase } from '../src/seed/reset'

async function main() {
  const { values } = parseArgs({ options: { confirm: { type: 'string' } } })
  const target = loadDatabaseTarget(process.env)

  const { db, close } = createDatabase(target.url)
  try {
    await resetDatabase(db, target, { confirmHost: values.confirm, log: console.log })
    console.log('Banco zerado. Rode o seed para recriar as contas.')
  } finally {
    await close()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
