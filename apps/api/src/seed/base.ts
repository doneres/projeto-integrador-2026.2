import type { Role } from '@axis/contracts'
import { eq, or } from 'drizzle-orm'
import type { Database } from '../db/client'
import { systemSettings, users } from '../db/schema'
import { createUser, type NewUser } from '../users/create-user'

/** Uma senha por perfil. Sem valor padrão no código: vêm do ambiente (`loadSeedPasswords`). */
export type SeedPasswords = Record<Role, string>

export type SeedReport = {
  created: string[]
  existing: string[]
}

type Account = Omit<NewUser, 'password' | 'coordinatorId' | 'role'>

// E-mails, matrículas e nomes do Coordenador e do Vendedor iguais aos da API simulada do web
// (apps/web/src/mocks/data.ts), para a troca do mock pela API real não mudar as contas.
const COORDINATOR: Account = {
  name: 'Maria Souza',
  email: 'gestor@axis.example',
  registration: '1001',
}
const SELLER: Account = {
  name: 'Bruno Exemplo',
  email: 'vendedor@axis.example',
  registration: '2001',
}
const DIRECTOR: Account = {
  name: 'Diana Exemplo',
  email: 'diretor@axis.example',
  registration: '3001',
}
const ADMINISTRATOR: Account = {
  name: 'Alice Exemplo',
  email: 'administrador@axis.example',
  registration: '4001',
}

const DEFAULT_SETTINGS = {
  checkinRadiusMeters: 100,
  scoreWeightRevenue: 50,
  scoreWeightVisits: 30,
  scoreWeightNewCustomers: 20,
}

/**
 * Cria a conta se ela ainda não existir; a que já existe fica como está. E-mail ou matrícula de
 * uma conta de outro perfil interrompe o seed, em vez de misturar as duas.
 */
export async function ensureUser(db: Database, report: SeedReport, account: NewUser) {
  const [existing] = await db
    .select()
    .from(users)
    .where(or(eq(users.email, account.email), eq(users.registration, account.registration)))
  if (existing) {
    if (existing.role !== account.role) {
      throw new Error(
        `Não dá para criar ${account.email} (${account.role}): o e-mail ou a matrícula ` +
          `${account.registration} já é de ${existing.email} (${existing.role}).`,
      )
    }
    report.existing.push(account.email)
    return existing
  }
  const created = await createUser(db, account)
  report.created.push(account.email)
  return created
}

/**
 * Camada obrigatória em qualquer ambiente: os Parâmetros do sistema e uma conta por perfil. Só
 * cria o que falta: o que já existe fica como está, então rodar de novo não desfaz um raio
 * ajustado, uma senha trocada nem uma conta desativada. Para recomeçar: reset + seed.
 */
export async function seedBase(db: Database, passwords: SeedPasswords) {
  const report: SeedReport = { created: [], existing: [] }

  await db.insert(systemSettings).values(DEFAULT_SETTINGS).onConflictDoNothing()

  const coordinator = await ensureUser(db, report, {
    ...COORDINATOR,
    role: 'coordinator',
    password: passwords.coordinator,
  })
  const seller = await ensureUser(db, report, {
    ...SELLER,
    role: 'seller',
    password: passwords.seller,
    coordinatorId: coordinator.id,
  })
  await ensureUser(db, report, { ...DIRECTOR, role: 'director', password: passwords.director })
  await ensureUser(db, report, {
    ...ADMINISTRATOR,
    role: 'administrator',
    password: passwords.administrator,
  })

  return { ...report, coordinator, seller }
}
