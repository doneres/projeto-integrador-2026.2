// Cria os Parâmetros do sistema e uma conta por perfil (veja o README). Pode rodar de novo à vontade.
// Uso: pnpm --filter @axis/api db:seed   (precisa do Postgres de pé e das migrations aplicadas)
import { createDatabase } from '../src/db/client'
import { seedBase } from '../src/seed/base'
import { loadDatabaseTarget, loadSeedPasswords } from '../src/seed/env'

async function main() {
  const target = loadDatabaseTarget(process.env)
  const passwords = loadSeedPasswords(process.env, target)
  console.log(`Seed no banco em ${target.host}...`)

  const { db, close } = createDatabase(target.url)
  try {
    const { created, existing } = await seedBase(db, passwords)
    for (const email of created) console.log(`criado: ${email}`)
    for (const email of existing) console.log(`já existe: ${email}`)
  } finally {
    await close()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
