import { createHash } from 'node:crypto'
import type { Role } from '@axis/contracts'
import { signToken } from '../../src/auth/token'
import type { Database } from '../../src/db/client'
import { createUser } from '../../src/users/create-user'
import { TEST_JWT_SECRET } from './config'

const PASSWORD = 'senha-do-teste'

/**
 * Duas Equipes, um Diretor e um Administrador: o cenário mínimo para provar o escopo por perfil.
 * Equipe A: coordenador e dois vendedores. Equipe B: coordenador e um vendedor.
 */
export async function createWorld(db: Database) {
  const make = (key: string, role: Role, coordinatorId?: string) =>
    createUser(db, {
      name: key,
      email: `${key}@axis.test`,
      // Matrícula única e curta a partir da chave.
      registration: createHash('sha1').update(key).digest('hex').slice(0, 8),
      password: PASSWORD,
      role,
      ...(coordinatorId ? { coordinatorId } : {}),
    })

  const coordinatorA = await make('coord-a', 'coordinator')
  const coordinatorB = await make('coord-b', 'coordinator')
  return {
    coordinatorA,
    coordinatorB,
    sellerA1: await make('seller-a1', 'seller', coordinatorA.id),
    sellerA2: await make('seller-a2', 'seller', coordinatorA.id),
    sellerB1: await make('seller-b1', 'seller', coordinatorB.id),
    director: await make('director', 'director'),
    admin: await make('admin', 'administrator'),
  }
}

/** Cabeçalho Authorization de um usuário, como o login o entregaria. */
export async function bearer(user: { id: string }) {
  const { token } = await signToken(TEST_JWT_SECRET, user.id)
  return { authorization: `Bearer ${token}` }
}
