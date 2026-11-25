import {
  type GoalFilters,
  type GoalInput,
  type GoalsMonthlyReport,
  goalsMonthlyReportSchema,
  sellerScoreSummarySchema,
} from '@axis/contracts'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'
import { opcoesDeConsultaViva } from '../../lib/query-client'
import { paraQueryString } from '../clientes/queries'

export const metasKeys = {
  all: ['metas'] as const,
  monthly: (filtros: GoalFilters) => [...metasKeys.all, 'monthly', filtros] as const,
}

/**
 * Consulta "viva" com polling automático de 30s para o relatório de metas e score (#43, #63).
 * Atualiza o realizado e o score por vendedor sem recarregar a tela.
 */
export function useMetas(filtros: GoalFilters, habilitado = true) {
  const query = paraQueryString(filtros)
  return useQuery<GoalsMonthlyReport>({
    ...opcoesDeConsultaViva,
    queryKey: metasKeys.monthly(filtros),
    queryFn: () => apiFetch(query ? `/v1/goals?${query}` : '/v1/goals', goalsMonthlyReportSchema),
    placeholderData: keepPreviousData,
    enabled: habilitado,
  })
}

/**
 * Cadastra ou edita uma meta mensal para um vendedor (PUT /v1/goals/:sellerId/:month).
 * O cadastro da meta em si NÃO faz polling.
 */
export function useSalvarMeta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      sellerId,
      month,
      dados,
    }: {
      sellerId: string
      month: string
      dados: GoalInput
    }) =>
      apiFetch(
        `/v1/goals/${encodeURIComponent(sellerId)}/${encodeURIComponent(month)}`,
        sellerScoreSummarySchema,
        {
          method: 'PUT',
          body: JSON.stringify(dados),
        },
      ),
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: metasKeys.all })
    },
  })
}
