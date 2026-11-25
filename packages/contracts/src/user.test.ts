import { describe, expect, it } from 'vitest'
import {
  loginBodySchema,
  passwordResetSchema,
  roleSchema,
  sessionSchema,
  userFiltersSchema,
  userInputSchema,
  userSchema,
  userStatusChangeSchema,
  userUpdateInputSchema,
} from './user'

const user = {
  id: '0192f4a0-0000-7000-8000-0000000000a1',
  name: 'Maria Souza',
  email: 'maria@exemplo.com',
  registration: '1001',
  role: 'seller' as const,
  coordinatorId: '0192f4a0-0000-7000-8000-0000000000b2',
  active: true,
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

  it('assume active como true por padrão quando omitido', () => {
    const { active, ...semActive } = user
    const parsed = userSchema.parse(semActive)
    expect(parsed.active).toBe(true)
  })
})

describe('userInputSchema e userUpdateInputSchema', () => {
  it('aceita vendedor com coordenador válido', () => {
    const res = userInputSchema.safeParse({
      name: 'João Vendedor',
      email: 'joao@axis.example',
      registration: '5001',
      role: 'seller',
      coordinatorId: '0192f4a0-0000-7000-8000-0000000000a1',
    })
    expect(res.success).toBe(true)
  })

  it('recusa vendedor sem coordenador', () => {
    const res = userInputSchema.safeParse({
      name: 'João Vendedor',
      email: 'joao@axis.example',
      registration: '5001',
      role: 'seller',
      coordinatorId: null,
    })
    expect(res.success).toBe(false)
  })

  it('anula coordenador para perfis diferentes de vendedor', () => {
    const res = userInputSchema.parse({
      name: 'Carlos Coordenador',
      email: 'carlos@axis.example',
      registration: '5002',
      role: 'coordinator',
      coordinatorId: '0192f4a0-0000-7000-8000-0000000000a1',
    })
    expect(res.coordinatorId).toBeNull()
  })

  it('userUpdateInputSchema valida os dados de atualização', () => {
    const res = userUpdateInputSchema.safeParse({
      name: 'Nome Atualizado',
      email: 'novo@axis.example',
      registration: '1001',
      role: 'director',
    })
    expect(res.success).toBe(true)
  })
})

describe('userStatusChangeSchema e passwordResetSchema', () => {
  it('userStatusChangeSchema aceita boolean', () => {
    expect(userStatusChangeSchema.safeParse({ active: false }).success).toBe(true)
    expect(userStatusChangeSchema.safeParse({ active: true }).success).toBe(true)
    expect(userStatusChangeSchema.safeParse({ active: 'true' }).success).toBe(false)
  })

  it('passwordResetSchema exige no mínimo 6 caracteres', () => {
    expect(passwordResetSchema.safeParse({ newPassword: '12345' }).success).toBe(false)
    expect(passwordResetSchema.safeParse({ newPassword: '123456' }).success).toBe(true)
  })
})

describe('userFiltersSchema', () => {
  it('aplica valores padrão de ordenação e converte active booleano', () => {
    const filtros = userFiltersSchema.parse({ active: 'true' })
    expect(filtros.page).toBe(1)
    expect(filtros.perPage).toBe(20)
    expect(filtros.sortBy).toBe('name')
    expect(filtros.order).toBe('asc')
    expect(filtros.active).toBe(true)
  })
})

describe('sessionSchema', () => {
  it('aceita a resposta do login', () => {
    const session = { token: 'token', expiresAt: '2026-11-02T20:00:00Z', user }
    expect(sessionSchema.safeParse(session).success).toBe(true)
  })
})
