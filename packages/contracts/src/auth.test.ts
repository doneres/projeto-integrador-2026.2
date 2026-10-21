import { describe, expect, it } from 'vitest'
import { loginSchema, PERFIS_DO_PAINEL, sessaoSchema } from './auth'

describe('loginSchema', () => {
  it('aceita e-mail ou matrícula com senha de 8 caracteres', () => {
    expect(loginSchema.safeParse({ identificador: '1001', senha: '12345678' }).success).toBe(true)
  })

  it('exige o e-mail ou a matrícula', () => {
    const { error } = loginSchema.safeParse({ identificador: '  ', senha: '12345678' })
    expect(error?.issues[0]?.message).toBe('Informe o e-mail ou a matrícula')
  })

  it('exige senha com no mínimo 8 caracteres', () => {
    const { error } = loginSchema.safeParse({ identificador: '1001', senha: '1234' })
    expect(error?.issues[0]?.message).toBe('A senha tem no mínimo 8 caracteres')
  })
})

describe('sessaoSchema', () => {
  const sessao = {
    token: 'token',
    expiraEm: '2026-10-21T11:00:00Z',
    usuario: {
      id: '0192f4a0-0000-7000-8000-0000000000a1',
      nome: 'Maria Souza',
      email: 'maria@exemplo.com',
      matricula: '1001',
      perfil: 'coordenador',
    },
  }

  it('aceita a resposta do login', () => {
    expect(sessaoSchema.safeParse(sessao).success).toBe(true)
  })

  it('recusa perfil fora da lista', () => {
    const invalida = { ...sessao, usuario: { ...sessao.usuario, perfil: 'gerente' } }
    expect(sessaoSchema.safeParse(invalida).success).toBe(false)
  })
})

describe('PERFIS_DO_PAINEL', () => {
  it('deixa o vendedor de fora, porque ele usa o app mobile', () => {
    expect(PERFIS_DO_PAINEL).not.toContain('vendedor')
  })
})
