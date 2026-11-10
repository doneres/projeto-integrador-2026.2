// Cria a camada base (Parâmetros do sistema e uma conta por perfil) e, com --profile=demo, a massa
// de demonstração (veja o README). Pode rodar de novo à vontade.
// Uso: pnpm --filter @axis/api db:seed [--profile=demo]   (precisa do Postgres de pé e das migrations aplicadas)
import { parseArgs } from 'node:util'
import { createDatabase } from '../src/db/client'
import { type SeedReport, seedBase } from '../src/seed/base'
import { seedDemo } from '../src/seed/demo'
import { loadDatabaseTarget, loadDemoLocation, loadSeedPasswords } from '../src/seed/env'

async function main() {
  const { values } = parseArgs({ options: { profile: { type: 'string', default: 'base' } } })
  if (values.profile !== 'base' && values.profile !== 'demo') {
    throw new Error(`Perfil desconhecido: ${values.profile}. Use --profile=base ou --profile=demo.`)
  }

  const target = loadDatabaseTarget(process.env)
  const passwords = loadSeedPasswords(process.env, target)
  const demoLocation = values.profile === 'demo' ? loadDemoLocation(process.env) : undefined
  console.log(`Seed ${values.profile} no banco em ${target.host}...`)

  const { db, close } = createDatabase(target.url)
  try {
    if (values.profile === 'demo') {
      const report = await seedDemo(db, { passwords, now: new Date(), demoLocation })
      printAccounts(report)
      console.log(`Clientes criados: ${report.customersCreated}`)
      console.log(`Rotas criadas: ${report.routesCreated}`)
      console.log(
        `Histórico: ${report.historyRoutesCreated} rotas e ${report.historyVisitsCreated} Visitas criadas`,
      )
    } else {
      printAccounts(await seedBase(db, passwords))
    }
  } finally {
    await close()
  }
}

function printAccounts({ created, existing }: SeedReport) {
  for (const email of created) console.log(`criado: ${email}`)
  for (const email of existing) console.log(`já existe: ${email}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
