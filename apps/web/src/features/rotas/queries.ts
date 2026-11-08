import {
  type CreateRouteBody,
  pageOf,
  type RouteFilters,
  routeDetailSchema,
  routeSchema,
  userSchema,
} from '@axis/contracts'
import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'
import { paraQueryString } from '../clientes/queries'

const paginaDeRotasSchema = pageOf(routeSchema)
const paginaDeUsuariosSchema = pageOf(userSchema)

export const rotasKeys = {
  all: ['rotas'] as const,
  lists: () => [...rotasKeys.all, 'list'] as const,
  list: (filtros: RouteFilters) => [...rotasKeys.lists(), filtros] as const,
  detail: (id: string) => [...rotasKeys.all, 'detail', id] as const,
}

export function useRotas(filtros: RouteFilters) {
  return useQuery({
    queryKey: rotasKeys.list(filtros),
    queryFn: () => apiFetch(`/v1/routes?${paraQueryString(filtros)}`, paginaDeRotasSchema),
    placeholderData: keepPreviousData,
  })
}

function opcoesDaRota(id: string) {
  return {
    queryKey: rotasKeys.detail(id),
    queryFn: () => apiFetch(`/v1/routes/${encodeURIComponent(id)}`, routeDetailSchema),
  }
}

export function useRota(id: string | undefined) {
  return useQuery({ ...opcoesDaRota(id ?? ''), enabled: Boolean(id) })
}

/**
 * Detalhe de várias rotas, para mostrar o progresso das Visitas na lista. A listagem
 * (GET /v1/routes) não traz as Visitas, então cada rota da página é buscada à parte (até 20).
 */
export function useDetalhesDasRotas(ids: readonly string[]) {
  return useQueries({ queries: ids.map((id) => opcoesDaRota(id)) })
}

/** Vendedores da Equipe do Coordenador (GET /v1/users?role=seller, #79). */
export function useVendedores() {
  return useQuery({
    queryKey: ['usuarios', 'vendedores'],
    queryFn: () =>
      apiFetch(
        `/v1/users?${paraQueryString({ role: 'seller', perPage: 100 })}`,
        paginaDeUsuariosSchema,
      ),
    staleTime: 5 * 60_000,
  })
}

/** Monta a rota do dia de um vendedor (POST /v1/routes, #79). As Visitas nascem Pendentes. */
export function useCriarRota() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (corpo: CreateRouteBody) =>
      apiFetch('/v1/routes', routeDetailSchema, { method: 'POST', body: JSON.stringify(corpo) }),
    onSuccess: (rota) => {
      queryClient.setQueryData(rotasKeys.detail(rota.id), rota)
      return queryClient.invalidateQueries({ queryKey: rotasKeys.lists() })
    },
  })
}
