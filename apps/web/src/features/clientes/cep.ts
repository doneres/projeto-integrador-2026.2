import { apenasDigitos } from '@axis/contracts'
import { z } from 'zod'

/** Tempo máximo de espera por serviço de CEP. */
export const TEMPO_LIMITE_CEP_MS = 5000

export type EnderecoDoCep = { logradouro: string; bairro: string; cidade: string; uf: string }

export type ResultadoCep =
  | { situacao: 'encontrado'; endereco: EnderecoDoCep }
  | { situacao: 'nao-encontrado' }
  | { situacao: 'indisponivel' }

export type ProvedorDeCep = (cep: string, sinal: AbortSignal) => Promise<ResultadoCep>

const viaCepSchema = z.object({
  logradouro: z.string(),
  bairro: z.string(),
  localidade: z.string(),
  uf: z.string(),
})
const viaCepNaoEncontradoSchema = z.object({ erro: z.union([z.literal(true), z.literal('true')]) })
const brasilApiSchema = z.object({
  street: z.string().nullish(),
  neighborhood: z.string().nullish(),
  city: z.string(),
  state: z.string(),
})

const viaCep: ProvedorDeCep = async (cep, sinal) => {
  const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: sinal })
  if (!resposta.ok) {
    throw new Error(`ViaCEP respondeu ${resposta.status}`)
  }
  const corpo: unknown = await resposta.json()
  if (viaCepNaoEncontradoSchema.safeParse(corpo).success) {
    return { situacao: 'nao-encontrado' }
  }
  const dados = viaCepSchema.parse(corpo)
  return {
    situacao: 'encontrado',
    endereco: {
      logradouro: dados.logradouro,
      bairro: dados.bairro,
      cidade: dados.localidade,
      uf: dados.uf,
    },
  }
}

const brasilApi: ProvedorDeCep = async (cep, sinal) => {
  const resposta = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`, { signal: sinal })
  if (resposta.status === 404) {
    return { situacao: 'nao-encontrado' }
  }
  if (!resposta.ok) {
    throw new Error(`BrasilAPI respondeu ${resposta.status}`)
  }
  const dados = brasilApiSchema.parse(await resposta.json())
  return {
    situacao: 'encontrado',
    endereco: {
      logradouro: dados.street ?? '',
      bairro: dados.neighborhood ?? '',
      cidade: dados.city,
      uf: dados.state,
    },
  }
}

/**
 * RF07: busca o endereço pelo CEP no ViaCEP e, se ele falhar, na BrasilAPI.
 * Cada serviço tem até 5 s. Se nenhum responder, a tela pede o preenchimento manual.
 */
export async function buscarEnderecoPorCep(
  cepDigitado: string,
  provedores: ProvedorDeCep[] = [viaCep, brasilApi],
): Promise<ResultadoCep> {
  const cep = apenasDigitos(cepDigitado)
  if (cep.length !== 8) {
    return { situacao: 'nao-encontrado' }
  }
  for (const provedor of provedores) {
    try {
      return await provedor(cep, AbortSignal.timeout(TEMPO_LIMITE_CEP_MS))
    } catch {
      // Falha ou tempo esgotado neste serviço: tenta o próximo.
    }
  }
  return { situacao: 'indisponivel' }
}
