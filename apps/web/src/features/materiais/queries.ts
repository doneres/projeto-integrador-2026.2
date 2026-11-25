import {
  type LoanDetail,
  type LoanEnd,
  type LoanFilters,
  type LoanInput,
  loanDetailSchema,
  type Page,
  type PosMaterial,
  type PosMaterialFilters,
  type PosMaterialInput,
  type PosMaterialStatusChange,
  pageOf,
  posMaterialSchema,
} from '@axis/contracts'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { apiFetch } from '../../lib/api'
import { paraQueryString } from '../clientes/queries'

const paginaDeMateriaisSchema = pageOf(posMaterialSchema)
const paginaDeComodatosSchema = pageOf(loanDetailSchema)

export const materiaisKeys = {
  all: ['materiais'] as const,
  lists: () => [...materiaisKeys.all, 'list'] as const,
  list: (filtros: PosMaterialFilters) => [...materiaisKeys.lists(), filtros] as const,
  detail: (id: string) => [...materiaisKeys.all, 'detail', id] as const,
}

export const comodatosKeys = {
  all: ['comodatos'] as const,
  lists: () => [...comodatosKeys.all, 'list'] as const,
  list: (filtros: LoanFilters) => [...comodatosKeys.lists(), filtros] as const,
}

export function useMateriais(filtros: PosMaterialFilters) {
  return useQuery<Page<PosMaterial>>({
    queryKey: materiaisKeys.list(filtros),
    queryFn: () =>
      apiFetch(`/v1/pos-materials?${paraQueryString(filtros)}`, paginaDeMateriaisSchema),
    placeholderData: keepPreviousData,
  })
}

export function useMaterial(id: string | undefined) {
  return useQuery({
    queryKey: materiaisKeys.detail(id ?? ''),
    queryFn: () => apiFetch(`/v1/pos-materials/${encodeURIComponent(id ?? '')}`, posMaterialSchema),
    enabled: Boolean(id),
  })
}

/** Cadastra (sem id) ou edita (com id) um material de PDV no catálogo. */
export function useSalvarMaterial() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...dados }: { id?: string } & PosMaterialInput) =>
      apiFetch(
        id ? `/v1/pos-materials/${encodeURIComponent(id)}` : '/v1/pos-materials',
        posMaterialSchema,
        {
          method: id ? 'PUT' : 'POST',
          body: JSON.stringify(dados),
        },
      ),
    onSuccess: (material) => {
      queryClient.setQueryData(materiaisKeys.detail(material.id), material)
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: materiaisKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: comodatosKeys.lists() }),
      ])
    },
  })
}

/** Inativa ou reativa um material de PDV no catálogo. */
export function useAlterarStatusMaterial() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, active }: { id: string } & PosMaterialStatusChange) =>
      apiFetch(`/v1/pos-materials/${encodeURIComponent(id)}/status`, posMaterialSchema, {
        method: 'PATCH',
        body: JSON.stringify({ active }),
      }),
    onSuccess: (material) => {
      queryClient.setQueryData(materiaisKeys.detail(material.id), material)
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: materiaisKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: comodatosKeys.lists() }),
      ])
    },
  })
}

/** Exclusão real de material de PDV (permitida somente sem comodatos ativos vinculados). */
export function useExcluirMaterial() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/v1/pos-materials/${encodeURIComponent(id)}`, z.void(), {
        method: 'DELETE',
      }),
    onSuccess: () => {
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: materiaisKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: comodatosKeys.lists() }),
      ])
    },
  })
}

/** Consulta paginada dos comodatos. */
export function useComodatos(filtros: LoanFilters) {
  return useQuery<Page<LoanDetail>>({
    queryKey: comodatosKeys.list(filtros),
    queryFn: () => apiFetch(`/v1/loans?${paraQueryString(filtros)}`, paginaDeComodatosSchema),
    placeholderData: keepPreviousData,
  })
}

/** Registra um novo comodato vinculando material a cliente. */
export function useSalvarComodato() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dados: LoanInput) =>
      apiFetch('/v1/loans', loanDetailSchema, {
        method: 'POST',
        body: JSON.stringify(dados),
      }),
    onSuccess: () => {
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: comodatosKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: materiaisKeys.lists() }),
      ])
    },
  })
}

/** Encerra um comodato informando a data de encerramento. */
export function useEncerrarComodato() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, endedAt }: { id: string } & LoanEnd) =>
      apiFetch(`/v1/loans/${encodeURIComponent(id)}/end`, loanDetailSchema, {
        method: 'PATCH',
        body: JSON.stringify({ endedAt }),
      }),
    onSuccess: () => {
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: comodatosKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: materiaisKeys.lists() }),
      ])
    },
  })
}
