import { type Prospect, syncSnapshotSchema } from '@axis/contracts'
import type { ApiClient } from '@/services/api-client'

/** O Render Free dorme em 15 min e leva cerca de um minuto para acordar: a leitura espera até 90 s. */
export const PROSPECT_TIMEOUT_MS = 90_000

export type ProspectRepository = {
  /**
   * As Prospecções que o próprio Vendedor cadastrou, da mais nova para a mais antiga, com o
   * estado e o motivo da rejeição. Prospecção não entra em rota nem recebe Pedido (RN04).
   */
  list(): Promise<Prospect[]>
}

/**
 * Implementação online: lê o snapshot (`GET /v1/sync/snapshot`) e fica com as Prospecções. Na onda
 * do offline (#27) o app lê do banco local, que o snapshot alimenta, sem mudar a tela.
 */
export function createProspectRepository(api: Pick<ApiClient, 'request'>): ProspectRepository {
  return {
    async list() {
      const response = await api.request('/v1/sync/snapshot', { timeoutMs: PROSPECT_TIMEOUT_MS })
      return syncSnapshotSchema.parse(response).prospects
    },
  }
}
