import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from './api'
import { encerrarSessao, obterSessao } from './sessao'

/**
 * Intervalo das consultas "vivas" (#52, #61): "tempo real" no painel significa até 30 s depois de
 * o servidor receber o dado. Mesma constante do `staleTime`.
 */
export const INTERVALO_CONSULTA_VIVA_MS = 30_000

/**
 * Configuração compartilhada das consultas "vivas" (dashboard #61, visitas e flags #62, metas #63):
 * repete a cada 30 s só com a aba visível e busca de novo na hora ao voltar o foco para a aba.
 * Telas de cadastro e formulários não usam esta configuração.
 */
export const opcoesDeConsultaViva = {
  staleTime: INTERVALO_CONSULTA_VIVA_MS,
  refetchInterval: INTERVALO_CONSULTA_VIVA_MS,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: 'always',
} as const

/** Erros 4xx não mudam com uma nova tentativa (dado inválido, sem permissão, não encontrado). */
export function deveTentarDeNovo(falhas: number, erro: unknown): boolean {
  if (erro instanceof ApiError && erro.status >= 400 && erro.status < 500) {
    return false
  }
  return falhas < 2
}

/** Um 401 com sessão aberta indica token vencido ou revogado: encerra a sessão e o app volta ao login. */
export function tratarErroGlobal(erro: unknown): void {
  if (erro instanceof ApiError && erro.status === 401 && obterSessao() !== null) {
    encerrarSessao()
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: tratarErroGlobal }),
  mutationCache: new MutationCache({ onError: tratarErroGlobal }),
  defaultOptions: {
    queries: {
      staleTime: INTERVALO_CONSULTA_VIVA_MS,
      retry: deveTentarDeNovo,
    },
  },
})
