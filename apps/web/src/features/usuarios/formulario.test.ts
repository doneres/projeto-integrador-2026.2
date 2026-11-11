import { describe, expect, it } from 'vitest'
import { validarCriacaoUsuario, validarEdicaoUsuario, validarRedefinicaoSenha } from './formulario'

describe('Formulário de Usuários e Perfis (#45)', () => {
  it('valida criação com dados corretos de vendedor vinculado a coordenador', () => {
    const res = validarCriacaoUsuario({
      name: 'João Silva',
      email: 'joao@example.com',
      registration: '1234',
      role: 'seller',
      coordinatorId: '0192f4a0-0000-7000-8000-0000000000a1',
      password: 'minhasenha123',
    })
    expect(res.erros).toEqual({})
    expect(res.dados).toBeDefined()
    expect(res.dados?.role).toBe('seller')
    expect(res.dados?.coordinatorId).toBe('0192f4a0-0000-7000-8000-0000000000a1')
  })

  it('exige coordenador quando perfil for vendedor', () => {
    const res = validarCriacaoUsuario({
      name: 'João Silva',
      email: 'joao@example.com',
      registration: '1234',
      role: 'seller',
      coordinatorId: '',
    })
    expect(res.erros.coordinatorId).toBe('Vendedores devem ser vinculados a um Coordenador')
  })

  it('anula coordenador quando perfil não for vendedor', () => {
    const res = validarCriacaoUsuario({
      name: 'Carlos Coordenador',
      email: 'carlos@example.com',
      registration: '5678',
      role: 'coordinator',
      coordinatorId: '0192f4a0-0000-7000-8000-0000000000a1',
    })
    expect(res.erros).toEqual({})
    expect(res.dados?.coordinatorId).toBeNull()
  })

  it('valida edição de usuário', () => {
    const res = validarEdicaoUsuario({
      name: 'Maria Diretora',
      email: 'maria@example.com',
      registration: '9999',
      role: 'director',
    })
    expect(res.erros).toEqual({})
    expect(res.dados?.role).toBe('director')
    expect(res.dados?.coordinatorId).toBeNull()
  })

  it('valida redefinição de senha com no mínimo 6 caracteres e confirmação', () => {
    const curta = validarRedefinicaoSenha({
      newPassword: '123',
      confirmPassword: '123',
    })
    expect(curta.erros.newPassword).toBe('A nova senha deve ter no mínimo 6 caracteres')

    const divergente = validarRedefinicaoSenha({
      newPassword: 'senha-segura-1',
      confirmPassword: 'senha-diferente-2',
    })
    expect(divergente.erros.confirmPassword).toBe('A confirmação de senha não confere')

    const valida = validarRedefinicaoSenha({
      newPassword: 'senha-valida-2026',
      confirmPassword: 'senha-valida-2026',
    })
    expect(valida.erros).toEqual({})
    expect(valida.dados?.newPassword).toBe('senha-valida-2026')
  })
})
