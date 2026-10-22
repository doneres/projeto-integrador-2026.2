import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { ApiError, apiFetch, SEM_RESPOSTA } from './api'
import { encerrarSessao, iniciarSessao } from './sessao'

const schema = z.object({ ok: z.boolean() })

function respostaJson(corpo: unknown, status = 200, tipo = 'application/json') {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': tipo } })
}

afterEach(() => {
  vi.restoreAllMocks()
  encerrarSessao()
})

describe('apiFetch', () => {
  it('devolve o corpo validado pelo schema do contrato', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(respostaJson({ ok: true }))
    await expect(apiFetch('/v1/teste', schema)).resolves.toEqual({ ok: true })
  })

  it('não envia Content-Type em requisições sem corpo', async () => {
    const fetchSimulado = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(respostaJson({ ok: true }))
    await apiFetch('/v1/teste', schema)
    const cabecalhos = new Headers(fetchSimulado.mock.calls[0]?.[1]?.headers)
    expect(cabecalhos.has('Content-Type')).toBe(false)
    expect(cabecalhos.get('Accept')).toContain('application/json')
  })

  it('envia o token da sessão no cabeçalho Authorization', async () => {
    const fetchSimulado = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(respostaJson({ ok: true }))
    iniciarSessao({
      token: 'abc',
      expiraEm: '2999-01-01T00:00:00Z',
      usuario: {
        id: '0192f4a0-0000-7000-8000-0000000000a1',
        nome: 'Maria Souza',
        email: 'gestor@axis.example',
        matricula: '1001',
        perfil: 'coordenador',
      },
    })
    await apiFetch('/v1/teste', schema)
    const cabecalhos = new Headers(fetchSimulado.mock.calls[0]?.[1]?.headers)
    expect(cabecalhos.get('Authorization')).toBe('Bearer abc')
  })

  it('converte um Problem Details (RFC 9457) em ApiError', async () => {
    const problema = {
      type: 'about:blank',
      title: 'Dados inválidos',
      status: 422,
      detail: 'Revise os campos destacados.',
      codigo: 'VALIDACAO',
      erros: [{ campo: 'endereco.cep', mensagem: 'O CEP deve ter 8 dígitos' }],
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      respostaJson(problema, 422, 'application/problem+json'),
    )
    const erro = await apiFetch('/v1/teste', schema).catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(ApiError)
    expect(erro).toMatchObject({
      status: 422,
      codigo: 'VALIDACAO',
      message: 'Revise os campos destacados.',
      erros: problema.erros,
    })
  })

  it('usa ERRO_DESCONHECIDO quando o erro não vem no formato do contrato', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Internal Server Error', { status: 500 }),
    )
    await expect(apiFetch('/v1/teste', schema)).rejects.toMatchObject({
      status: 500,
      codigo: 'ERRO_DESCONHECIDO',
    })
  })

  it('sinaliza falta de conexão quando a requisição não chega ao servidor', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(apiFetch('/v1/teste', schema)).rejects.toMatchObject({
      status: SEM_RESPOSTA,
      codigo: 'SEM_CONEXAO',
    })
  })

  it('recusa uma resposta fora do contrato', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(respostaJson({ ok: 'sim' }))
    await expect(apiFetch('/v1/teste', schema)).rejects.toMatchObject({
      codigo: 'RESPOSTA_INVALIDA',
    })
  })
})
