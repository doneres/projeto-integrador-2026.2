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
    auth: { jwtSecret: env.jwtSecret },
    // O Render põe um proxy na frente: sem isso todos os clientes teriam o mesmo endereço. Confia
    // só nesse salto: com `true`, o cliente forjaria o X-Forwarded-For e furaria o limite do login.
    trustProxy: env.nodeEnv === 'production' ? 1 : 0,
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
