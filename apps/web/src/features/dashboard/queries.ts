import { type DashboardFilters, dashboardSummarySchema } from '@axis/contracts'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'
import { opcoesDeConsultaViva } from '../../lib/query-client'
import { paraQueryString } from '../clientes/queries'

export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: (filtros: DashboardFilters) => [...dashboardKeys.all, 'summary', filtros] as const,
}

/** Indicadores consolidados do painel ao vivo (GET /v1/dashboard, #40 e #61). */
export function useDashboard(filtros: DashboardFilters, habilitado = true) {
  const query = paraQueryString(filtros)
  return useQuery({
    ...opcoesDeConsultaViva,
    queryKey: dashboardKeys.summary(filtros),
    queryFn: () =>
      apiFetch(query ? `/v1/dashboard?${query}` : '/v1/dashboard', dashboardSummarySchema),
    placeholderData: keepPreviousData,
    enabled: habilitado,
  })
}
