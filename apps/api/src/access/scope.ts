import type { Role, User } from '@axis/contracts'
import { eq, inArray, or, type SQL } from 'drizzle-orm'
import type { Database } from '../db/client'
import { customers, routes, users, visits } from '../db/schema'
import { ApiError } from '../errors'

// Escopo por perfil (docs/05-modelo-dados): o Vendedor vê só as próprias rotas e os clientes
// delas, o Coordenador só a sua Equipe e o Diretor tudo. Cada função devolve a condição SQL que
// restringe a consulta, ou `undefined` quando o perfil enxerga tudo. O Administrador cuida de
// contas e parâmetros: não lê clientes nem rotas.

const noPermission = () =>
  new ApiError(403, 'SEM_PERMISSAO', 'Seu perfil não tem acesso a este recurso')

/** Recusa (403) quem não tem um dos perfis. */
export function requireRole(user: User, ...allowed: Role[]): void {
  if (!allowed.includes(user.role)) throw noPermission()
}

/** Condição que limita uma consulta de `route` ao que o usuário pode ver. */
export function routeScope(db: Database, user: User): SQL | undefined {
  switch (user.role) {
    case 'seller':
      return eq(routes.sellerId, user.id)
    case 'coordinator':
      return inArray(
        routes.sellerId,
        db.select({ id: users.id }).from(users).where(eq(users.coordinatorId, user.id)),
      )
    case 'director':
      return undefined
    default:
      throw noPermission()
  }
}

/** Condição que limita uma consulta de `customer` ao que o usuário pode ver. */
export function customerScope(db: Database, user: User): SQL | undefined {
  switch (user.role) {
    case 'seller':
      // Os clientes das rotas dele (de qualquer dia) e as prospecções que ele mesmo cadastrou.
      return or(
        inArray(
          customers.id,
          db
            .select({ id: visits.customerId })
            .from(visits)
            .innerJoin(routes, eq(visits.routeId, routes.id))
            .where(eq(routes.sellerId, user.id)),
        ),
        eq(customers.createdById, user.id),
      )
    case 'coordinator':
      return eq(customers.coordinatorId, user.id)
    case 'director':
      return undefined
    default:
      throw noPermission()
  }
}
