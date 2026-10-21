import { clienteSchema, paginaDe } from '@axis/contracts'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'

const paginaDeClientesSchema = paginaDe(clienteSchema)

export const clientesKeys = {
  all: ['clientes'] as const,
  list: (pagina: number, porPagina: number) =>
    [...clientesKeys.all, 'list', { pagina, porPagina }] as const,
}

export function useClientes(pagina = 1, porPagina = 20) {
  const parametros = new URLSearchParams({ pagina: String(pagina), porPagina: String(porPagina) })
  return useQuery({
    queryKey: clientesKeys.list(pagina, porPagina),
    queryFn: () => apiFetch(`/v1/clientes?${parametros}`, paginaDeClientesSchema),
  })
}
