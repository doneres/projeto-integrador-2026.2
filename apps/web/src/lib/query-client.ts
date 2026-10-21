import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './api'

/** Erros 4xx não mudam com uma nova tentativa (dado inválido, sem permissão, não encontrado). */
export function deveTentarDeNovo(falhas: number, erro: unknown): boolean {
  if (erro instanceof ApiError && erro.status >= 400 && erro.status < 500) {
    return false
  }
  return falhas < 2
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: deveTentarDeNovo,
    },
  },
})
