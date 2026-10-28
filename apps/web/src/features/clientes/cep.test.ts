import { afterEach, describe, expect, it, vi } from 'vitest'
import { buscarEnderecoPorCep } from './cep'

function responder(respostas: Record<string, () => Response>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (entrada) => {
    const url = String(entrada)
    for (const [prefixo, resposta] of Object.entries(respostas)) {
      if (url.startsWith(prefixo)) {
        return resposta()
      }
    }
    throw new TypeError('Failed to fetch')
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('buscarEnderecoPorCep', () => {
  it('preenche o endereço com o ViaCEP', async () => {
    responder({
      'https://viacep.com.br/': () =>
        Response.json({
          cep: '74000-000',
          logradouro: 'Rua Exemplo',
          bairro: 'Setor Central',
          localidade: 'Goiânia',
          uf: 'GO',
        }),
    })
    await expect(buscarEnderecoPorCep('74000-000')).resolves.toEqual({
      situacao: 'encontrado',
      endereco: { logradouro: 'Rua Exemplo', bairro: 'Setor Central', cidade: 'Goiânia', uf: 'GO' },
    })
  })

  it('avisa quando o CEP não existe, sem consultar a BrasilAPI', async () => {
    const fetchSimulado = responder({
      'https://viacep.com.br/': () => Response.json({ erro: 'true' }),
    })
    await expect(buscarEnderecoPorCep('99999999')).resolves.toEqual({ situacao: 'nao-encontrado' })
    expect(fetchSimulado).toHaveBeenCalledTimes(1)
  })

  it('usa a BrasilAPI quando o ViaCEP falha', async () => {
    responder({
      'https://brasilapi.com.br/': () =>
        Response.json({
          cep: '74000000',
          state: 'GO',
          city: 'Goiânia',
          neighborhood: 'Setor Central',
          street: 'Rua Exemplo',
          service: 'open-cep',
        }),
    })
    await expect(buscarEnderecoPorCep('74000000')).resolves.toEqual({
      situacao: 'encontrado',
      endereco: { logradouro: 'Rua Exemplo', bairro: 'Setor Central', cidade: 'Goiânia', uf: 'GO' },
    })
  })

  it('pede o preenchimento manual quando nenhum serviço responde', async () => {
    responder({})
    await expect(buscarEnderecoPorCep('74000000')).resolves.toEqual({ situacao: 'indisponivel' })
  })

  it('não consulta os serviços com CEP incompleto', async () => {
    const fetchSimulado = responder({})
    await expect(buscarEnderecoPorCep('7400')).resolves.toEqual({ situacao: 'nao-encontrado' })
    expect(fetchSimulado).not.toHaveBeenCalled()
  })

  it('dá a cada serviço um sinal com tempo limite', async () => {
    const sinais: AbortSignal[] = []
    await buscarEnderecoPorCep('74000000', [
      async (_cep, sinal) => {
        sinais.push(sinal)
        throw new Error('falhou')
      },
    ])
    expect(sinais[0]).toBeInstanceOf(AbortSignal)
  })
})
