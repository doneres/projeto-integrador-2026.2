import { type DashboardFilters, dashboardSummarySchema } from '@axis/contracts'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'
import { paraQueryString } from '../clientes/queries'

export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: (filtros: DashboardFilters) => [...dashboardKeys.all, 'summary', filtros] as const,
}

/** Indicadores consolidados do painel (GET /v1/dashboard, #40). A #61 deixará esta consulta viva. */
export function useDashboard(filtros: DashboardFilters) {
  const query = paraQueryString(filtros)
  return useQuery({
    queryKey: dashboardKeys.summary(filtros),
    queryFn: () =>
      apiFetch(query ? `/v1/dashboard?${query}` : '/v1/dashboard', dashboardSummarySchema),
    placeholderData: keepPreviousData,
  })
}
