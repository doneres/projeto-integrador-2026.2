import { describe, expect, it } from 'vitest'
import { loginBodySchema, roleSchema, sessionSchema, userSchema } from './user'

const user = {
  id: '0192f4a0-0000-7000-8000-0000000000a1',
  name: 'Maria Souza',
  email: 'maria@exemplo.com',
  registration: '1001',
  role: 'seller',
  coordinatorId: '0192f4a0-0000-7000-8000-0000000000b2',
}

describe('roleSchema', () => {
  it('aceita os quatro perfis do modelo de dados', () => {
    for (const role of ['seller', 'coordinator', 'director', 'administrator']) {
      expect(roleSchema.safeParse(role).success).toBe(true)
    }
  })

  it('recusa perfil fora da lista', () => {
    expect(roleSchema.safeParse('manager').success).toBe(false)
  })
})

describe('loginBodySchema', () => {
  it('aceita e-mail ou matrícula com senha', () => {
    expect(loginBodySchema.safeParse({ identifier: '1001', password: 'x' }).success).toBe(true)
  })

  it('exige o identificador e a senha', () => {
    expect(loginBodySchema.safeParse({ identifier: '  ', password: 'x' }).success).toBe(false)
    expect(loginBodySchema.safeParse({ identifier: '1001', password: '' }).success).toBe(false)
  })

  it('limita o tamanho da senha, para o argon2 não processar megabytes', () => {
    expect(
      loginBodySchema.safeParse({ identifier: '1001', password: 'x'.repeat(128) }).success,
    ).toBe(true)
    expect(
      loginBodySchema.safeParse({ identifier: '1001', password: 'x'.repeat(129) }).success,
    ).toBe(false)
  })
})

describe('userSchema', () => {
  it('aceita o vendedor com coordenador e os demais perfis sem', () => {
    expect(userSchema.safeParse(user).success).toBe(true)
    expect(userSchema.safeParse({ ...user, role: 'director', coordinatorId: null }).success).toBe(
      true,
    )
  })
})

describe('sessionSchema', () => {
  it('aceita a resposta do login', () => {
    const session = { token: 'token', expiresAt: '2026-11-02T20:00:00Z', user }
    expect(sessionSchema.safeParse(session).success).toBe(true)
  })
})
