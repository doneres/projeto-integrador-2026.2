import { describe, expect, it } from 'vitest'
import { ApiError, SEM_RESPOSTA } from './api'
import { deveTentarDeNovo } from './query-client'

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
