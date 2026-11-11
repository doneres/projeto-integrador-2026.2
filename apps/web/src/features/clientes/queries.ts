import {
  type Customer,
  type CustomerFilters,
  type CustomerInput,
  type CustomerRejection,
  type CustomerStatusChange,
  customerSchema,
  type Page,
  pageOf,
} from '@axis/contracts'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'
import { opcoesDeConsultaViva } from '../../lib/query-client'

const paginaDeClientesSchema = pageOf(customerSchema)

export const clientesKeys = {
  all: ['clientes'] as const,
  lists: () => [...clientesKeys.all, 'list'] as const,
  list: (filtros: CustomerFilters) => [...clientesKeys.lists(), filtros] as const,
  detail: (id: string) => [...clientesKeys.all, 'detail', id] as const,
}

/** Query string de uma listagem, sem os filtros vazios. */
export function paraQueryString(filtros: Readonly<Record<string, unknown>>): string {
  const parametros = new URLSearchParams()
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== '') {
      parametros.set(chave, String(valor))
    }
  }
  return parametros.toString()
}

export function useClientes(filtros: CustomerFilters) {
  return useQuery({
    queryKey: clientesKeys.list(filtros),
    queryFn: () => apiFetch(`/v1/customers?${paraQueryString(filtros)}`, paginaDeClientesSchema),
    placeholderData: keepPreviousData,
  })
}

export function useCliente(id: string | undefined) {
  return useQuery({
    queryKey: clientesKeys.detail(id ?? ''),
    queryFn: () => apiFetch(`/v1/customers/${encodeURIComponent(id ?? '')}`, customerSchema),
    enabled: Boolean(id),
  })
}

/** Cria (sem id) ou atualiza (com id) um cliente e atualiza as listas em cache. */
export function useSalvarCliente(id?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dados: CustomerInput) =>
      apiFetch(id ? `/v1/customers/${encodeURIComponent(id)}` : '/v1/customers', customerSchema, {
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
    mutationFn: ({ id, status }: { id: string } & CustomerStatusChange) =>
      apiFetch(`/v1/customers/${encodeURIComponent(id)}/status`, customerSchema, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: (cliente) => {
      queryClient.setQueryData(clientesKeys.detail(cliente.id), cliente)
      return queryClient.invalidateQueries({ queryKey: clientesKeys.lists() })
    },
  })
}

/**
 * Consulta prospecções cadastradas em campo pelos vendedores.
 * Com opção viva ativada, revalida a cada 30 segundos (ADR de tempo real).
 */
export function useProspeccoes(filtros: CustomerFilters, opcoes?: { vivo?: boolean }) {
  const filtrosProspeccao: CustomerFilters = { ...filtros, origin: 'prospect' }
  return useQuery<Page<Customer>>({
    queryKey: clientesKeys.list(filtrosProspeccao),
    queryFn: () =>
      apiFetch(`/v1/customers?${paraQueryString(filtrosProspeccao)}`, paginaDeClientesSchema),
    placeholderData: keepPreviousData,
    ...(opcoes?.vivo ? opcoesDeConsultaViva : {}),
  })
}

/** Aprova uma prospecção pendente da equipe (RF09, RN04). */
export function useAprovarProspeccao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/v1/customers/${encodeURIComponent(id)}/approval`, customerSchema, {
        method: 'POST',
      }),
    onSuccess: (cliente) => {
      queryClient.setQueryData(clientesKeys.detail(cliente.id), cliente)
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: clientesKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ])
    },
  })
}

/** Rejeita uma prospecção pendente com justificativa obrigatória (RF09, RN04). */
export function useRejeitarProspeccao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string } & CustomerRejection) =>
      apiFetch(`/v1/customers/${encodeURIComponent(id)}/rejection`, customerSchema, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: (cliente) => {
      queryClient.setQueryData(clientesKeys.detail(cliente.id), cliente)
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: clientesKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ])
    },
  })
}
