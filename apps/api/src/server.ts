import { buildApp } from './app'
import { createDatabase } from './db/client'
import { runMigrations } from './db/migrate'
import { EnvError, loadEnv } from './env'
import { MIGRATIONS_FOLDER } from './paths'

async function main() {
  const env = loadEnv(process.env)

  // Migrations antes de escutar, pela URL direta do banco (sem pooler).
  await runMigrations(env.databaseUrlUnpooled, MIGRATIONS_FOLDER)

  const { db, close } = createDatabase(env.databaseUrl)
  const app = await buildApp({
    db,
    logger: { level: env.nodeEnv === 'production' ? 'info' : 'debug' },
  })

  // O Render encerra o processo com SIGTERM a cada deploy.
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, async () => {
      await app.close()
      await close()
      process.exit(0)
    })
  }

  await app.listen({ port: env.port, host: '0.0.0.0' })
}

main().catch((error) => {
  // Env inválido é erro de configuração: mensagem limpa, sem stack trace.
  console.error(error instanceof EnvError ? error.message : error)
  process.exit(1)
})
