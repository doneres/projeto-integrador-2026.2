// Cria os usuários de desenvolvimento, um por perfil. A tela do Administrador ainda não existe,
// então este seed (e o código de teste) é o único jeito de ter uma conta para entrar.
// Uso: pnpm --filter @axis/api db:seed   (precisa do Postgres de pé e das migrations aplicadas)
import { eq } from 'drizzle-orm'
import { createDatabase } from '../src/db/client'
import { users } from '../src/db/schema'
import { createUser, type NewUser } from '../src/users/create-user'

const DEV_PASSWORD = 'axis-dev-123'

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('Defina DATABASE_URL (veja .env.example).')
  // As contas têm senha conhecida: só podem existir num banco local, nunca num servidor real.
  const { hostname } = new URL(databaseUrl)
  if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
    throw new Error(`DATABASE_URL aponta para ${hostname}; o seed só roda num Postgres local.`)
  }

  const { db, close } = createDatabase(databaseUrl)
  try {
    const createIfMissing = async (account: Omit<NewUser, 'password'>) => {
      const [existing] = await db.select().from(users).where(eq(users.email, account.email))
      if (existing) {
        console.log(`já existe: ${account.email}`)
        return existing
      }
      const created = await createUser(db, { ...account, password: DEV_PASSWORD })
      console.log(`criado: ${account.email} (${account.role})`)
      return created
    }

    await createIfMissing({
      name: 'Ana Administradora',
      email: 'admin@axis.dev',
      registration: '1000',
      role: 'administrator',
    })
    await createIfMissing({
      name: 'Davi Diretor',
      email: 'diretor@axis.dev',
      registration: '2000',
      role: 'director',
    })
    const coordinator = await createIfMissing({
      name: 'Carla Coordenadora',
      email: 'coordenador@axis.dev',
      registration: '3000',
      role: 'coordinator',
    })
    await createIfMissing({
      name: 'Vera Vendedora',
      email: 'vendedor@axis.dev',
      registration: '4000',
      role: 'seller',
      coordinatorId: coordinator.id,
    })
    console.log(`Senha de todos: ${DEV_PASSWORD}`)
  } finally {
    await close()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
