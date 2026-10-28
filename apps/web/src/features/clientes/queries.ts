import {
  clienteSchema,
  type DadosCliente,
  type FiltrosClientes,
  paginaDe,
  type StatusCliente,
} from '@axis/contracts'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'

const paginaDeClientesSchema = paginaDe(clienteSchema)

export const clientesKeys = {
  all: ['clientes'] as const,
  lists: () => [...clientesKeys.all, 'list'] as const,
  list: (filtros: FiltrosClientes) => [...clientesKeys.lists(), filtros] as const,
  detail: (id: string) => [...clientesKeys.all, 'detail', id] as const,
}

/** Query string da listagem, sem os filtros vazios. */
export function paraQueryString(filtros: Partial<FiltrosClientes>): string {
  const parametros = new URLSearchParams()
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== '') {
      parametros.set(chave, String(valor))
    }
  }
  return parametros.toString()
}

export function useClientes(filtros: FiltrosClientes) {
  return useQuery({
    queryKey: clientesKeys.list(filtros),
    queryFn: () => apiFetch(`/v1/clientes?${paraQueryString(filtros)}`, paginaDeClientesSchema),
    placeholderData: keepPreviousData,
  })
}

export function useCliente(id: string | undefined) {
  return useQuery({
    queryKey: clientesKeys.detail(id ?? ''),
    queryFn: () => apiFetch(`/v1/clientes/${encodeURIComponent(id ?? '')}`, clienteSchema),
    enabled: Boolean(id),
  })
}

/** Cria (sem id) ou atualiza (com id) um cliente e atualiza as listas em cache. */
export function useSalvarCliente(id?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dados: DadosCliente) =>
      apiFetch(id ? `/v1/clientes/${encodeURIComponent(id)}` : '/v1/clientes', clienteSchema, {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(dados),
      }),
    onSuccess: (cliente) => {
      queryClient.setQueryData(clientesKeys.detail(cliente.id), cliente)
      return queryClient.invalidateQueries({ queryKey: clientesKeys.lists() })
    },
  })
}

/** Inativa ou reativa um cliente (RF05). */
export function useAlterarStatusCliente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: StatusCliente }) =>
      apiFetch(`/v1/clientes/${encodeURIComponent(id)}/status`, clienteSchema, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: (cliente) => {
      queryClient.setQueryData(clientesKeys.detail(cliente.id), cliente)
      return queryClient.invalidateQueries({ queryKey: clientesKeys.lists() })
    },
  })
}
