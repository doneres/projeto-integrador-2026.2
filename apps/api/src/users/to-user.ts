import type { User } from '@axis/contracts'
import type { users } from '../db/schema'

/** A linha do banco sem o hash da senha: o que a API pode mostrar de um usuário. */
export function toUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    registration: row.registration,
    role: row.role,
    coordinatorId: row.coordinatorId,
  }
}
