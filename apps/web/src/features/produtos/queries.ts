import {
  type Page,
  type Product,
  type ProductFilters,
  type ProductInput,
  type ProductStatusChange,
  pageOf,
  productSchema,
} from '@axis/contracts'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'
import { paraQueryString } from '../clientes/queries'

const paginaDeProdutosSchema = pageOf(productSchema)

export const produtosKeys = {
  all: ['produtos'] as const,
  lists: () => [...produtosKeys.all, 'list'] as const,
  list: (filtros: ProductFilters) => [...produtosKeys.lists(), filtros] as const,
  detail: (id: string) => [...produtosKeys.all, 'detail', id] as const,
}

export function useProdutos(filtros: ProductFilters) {
  return useQuery<Page<Product>>({
    queryKey: produtosKeys.list(filtros),
    queryFn: () => apiFetch(`/v1/products?${paraQueryString(filtros)}`, paginaDeProdutosSchema),
    placeholderData: keepPreviousData,
  })
}

export function useProduto(id: string | undefined) {
  return useQuery({
    queryKey: produtosKeys.detail(id ?? ''),
    queryFn: () => apiFetch(`/v1/products/${encodeURIComponent(id ?? '')}`, productSchema),
    enabled: Boolean(id),
  })
}

/** Cadastra (sem id) ou edita (com id) um produto no catálogo. */
export function useSalvarProduto(id?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dados: ProductInput) =>
      apiFetch(id ? `/v1/products/${encodeURIComponent(id)}` : '/v1/products', productSchema, {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(dados),
      }),
    onSuccess: (produto) => {
      queryClient.setQueryData(produtosKeys.detail(produto.id), produto)
      return queryClient.invalidateQueries({ queryKey: produtosKeys.lists() })
    },
  })
}

/** Inativa ou reativa um produto no catálogo. */
export function useAlterarStatusProduto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, active }: { id: string } & ProductStatusChange) =>
      apiFetch(`/v1/products/${encodeURIComponent(id)}/status`, productSchema, {
        method: 'PATCH',
        body: JSON.stringify({ active }),
      }),
    onSuccess: (produto) => {
      queryClient.setQueryData(produtosKeys.detail(produto.id), produto)
      return queryClient.invalidateQueries({ queryKey: produtosKeys.lists() })
    },
  })
}
