import { describe, expect, it } from 'vitest'
import { ApiError, SEM_RESPOSTA } from './api'
import { deveTentarDeNovo, tratarErroGlobal } from './query-client'
import { iniciarSessao, obterSessao } from './sessao'

describe('deveTentarDeNovo', () => {
  it('não repete erros do cliente (4xx)', () => {
    const erro = new ApiError({ status: 404, codigo: 'NAO_ENCONTRADO', mensagem: '' })
    expect(deveTentarDeNovo(0, erro)).toBe(false)
  })

  it('repete falhas de conexão até duas vezes', () => {
    const erro = new ApiError({ status: SEM_RESPOSTA, codigo: 'SEM_CONEXAO', mensagem: '' })
    expect(deveTentarDeNovo(0, erro)).toBe(true)
    expect(deveTentarDeNovo(1, erro)).toBe(true)
    expect(deveTentarDeNovo(2, erro)).toBe(false)
  })
})

describe('tratarErroGlobal', () => {
  it('encerra a sessão quando a API responde 401', () => {
    iniciarSessao({
      token: 'vencido',
      expiresAt: '2999-01-01T00:00:00Z',
      user: {
        id: '0192f4a0-0000-7000-8000-0000000000a1',
        name: 'Maria Souza',
        email: 'gestor@axis.example',
        registration: '1001',
        role: 'coordinator',
        coordinatorId: null,
        active: true,
      },
    })
    tratarErroGlobal(new ApiError({ status: 401, codigo: 'NAO_AUTENTICADO', mensagem: '' }))
    expect(obterSessao()).toBeNull()
  })
})
