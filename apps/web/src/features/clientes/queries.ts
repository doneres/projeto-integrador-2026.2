import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'
import type { Cliente } from './types'

export const clientesKeys = {
  all: ['clientes'] as const,
  list: () => [...clientesKeys.all, 'list'] as const,
}

export function useClientes() {
  return useQuery({
    queryKey: clientesKeys.list(),
    queryFn: () => apiFetch<Cliente[]>('/v1/clientes'),
  })
}
