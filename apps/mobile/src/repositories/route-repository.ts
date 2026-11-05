import { type RouteDetail, routeDetailSchema } from '@axis/contracts'
import { type ApiClient, ApiRequestError } from '@/services/api-client'

/** O Render Free dorme em 15 min e leva cerca de um minuto para acordar: a leitura espera até 90 s. */
export const ROUTE_TIMEOUT_MS = 90_000

export type RouteRepository = {
  /** A rota de hoje do Vendedor com Visitas e Clientes, ou `null` se o Coordenador não montou uma. */
  today(): Promise<RouteDetail | null>
}

export function createRouteRepository(api: Pick<ApiClient, 'request'>): RouteRepository {
  return {
    async today() {
      try {
        const response = await api.request('/v1/routes/today', { timeoutMs: ROUTE_TIMEOUT_MS })
        return routeDetailSchema.parse(response)
      } catch (error) {
        if (
          error instanceof ApiRequestError &&
          error.status === 404 &&
          error.code === 'SEM_ROTA_HOJE'
        ) {
          return null
        }
        throw error
      }
    },
  }
}
