import type { Role } from '@axis/contracts'
import { eq } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { hashPassword } from '../auth/password'
import type { Database } from '../db/client'
import { users } from '../db/schema'

export type NewUser = {
  name: string
  email: string
  registration: string
  password: string
  role: Role
  /** Obrigatório e só permitido para vendedor; deve ser o id de um coordenador. */
  coordinatorId?: string
  active?: boolean
}

/**
 * Única porta de entrada de usuários: a tela do Administrador ainda não existe, então só o seed
 * e os testes criam contas. Confere a regra do modelo de dados que o banco não alcança: o
 * coordenador do vendedor tem de ser mesmo um coordenador.
 */
export async function createUser(db: Database, input: NewUser) {
  // O login trata identificador com "@" como e-mail; a matrícula não pode ser confundida com um.
  if (input.registration.includes('@')) {
    throw new Error('registration não pode conter "@"')
  }

  if (input.coordinatorId !== undefined) {
    const [coordinator] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, input.coordinatorId))
    if (coordinator?.role !== 'coordinator') {
      throw new Error('coordinatorId deve apontar para um usuário com perfil coordinator')
    }
  }

  const [created] = await db
    .insert(users)
    .values({
      id: uuidv7(),
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      registration: input.registration.trim(),
      passwordHash: await hashPassword(input.password),
      role: input.role,
      coordinatorId: input.coordinatorId ?? null,
      active: input.active ?? true,
    })
    .returning()
  if (!created) throw new Error('Falha ao criar o usuário')
  return created
}
