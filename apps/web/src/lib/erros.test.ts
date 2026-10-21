import { describe, expect, it } from 'vitest'
import { ApiError, SEM_RESPOSTA } from './api'
import { mensagemDeErro } from './erros'

describe('mensagemDeErro', () => {
  it('explica a falta de conexão', () => {
    const erro = new ApiError({ status: SEM_RESPOSTA, codigo: 'SEM_CONEXAO', mensagem: '' })
    expect(mensagemDeErro(erro)).toMatch(/Sem conexão/)
  })

  it('pede um novo login quando a sessão expira', () => {
    const erro = new ApiError({ status: 401, codigo: 'NAO_AUTENTICADO', mensagem: '' })
    expect(mensagemDeErro(erro)).toMatch(/Entre novamente/)
  })

  it('usa a mensagem da API nos erros de validação', () => {
    const erro = new ApiError({
      status: 422,
      codigo: 'VALIDACAO',
      mensagem: 'O CEP deve ter 8 dígitos',
    })
    expect(mensagemDeErro(erro)).toBe('O CEP deve ter 8 dígitos')
  })

  it('tem uma mensagem genérica para erros inesperados', () => {
    expect(mensagemDeErro(new Error('falha interna'))).toBe('Algo deu errado. Tente de novo.')
  })
})
