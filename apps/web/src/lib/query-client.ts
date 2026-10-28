import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from './api'
import { encerrarSessao, obterSessao } from './sessao'

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
      staleTime: 30_000,
      retry: deveTentarDeNovo,
    },
  },
})
