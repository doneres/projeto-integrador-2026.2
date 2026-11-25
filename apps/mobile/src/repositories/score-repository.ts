import { goalsMonthlyReportSchema, type SellerScoreSummary } from '@axis/contracts'
import type { ApiClient } from '@/services/api-client'

/** O Render Free dorme em 15 min e leva cerca de um minuto para acordar: a leitura espera até 90 s. */
export const SCORE_TIMEOUT_MS = 90_000

export type CachedScore = {
  summary: SellerScoreSummary
  /** Quando a leitura que gerou este valor terminou. */
  readAt: Date
}

export type ScoreRepository = {
  /**
   * Realizado e Score do mês corrente do próprio Vendedor, calculados pelo servidor na leitura
   * (`GET /v1/goals`, RF23 e RN02). Nada é calculado no app. Uma leitura que dá certo atualiza o
   * cache; uma que falha não mexe nele.
   */
  read(): Promise<SellerScoreSummary>
  /** A última leitura bem-sucedida deste Vendedor, ou `null`. Nunca devolve o Score de outro. */
  cached(sellerId: string): CachedScore | null
}

/**
 * Implementação online. O cache fica na memória do app, por Vendedor, e serve para mostrar o último
 * valor enquanto a nova leitura não chega ou sem rede.
 */
export function createScoreRepository(
  api: Pick<ApiClient, 'request'>,
  now: () => Date,
): ScoreRepository {
  const cache = new Map<string, CachedScore>()
  return {
    async read() {
      const response = await api.request('/v1/goals', { timeoutMs: SCORE_TIMEOUT_MS })
      // Para o Vendedor a API devolve só ele; lista vazia é conta inativa ou resposta inesperada.
      const [summary] = goalsMonthlyReportSchema.parse(response).sellers
      if (!summary) throw new Error('A API não devolveu o Score do Vendedor')
      cache.set(summary.sellerId, { summary, readAt: now() })
      return summary
    },
    cached: (sellerId) => cache.get(sellerId) ?? null,
  }
}
