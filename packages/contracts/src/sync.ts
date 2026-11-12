import { z } from 'zod'
import { instanteSchema } from './comum'
import { customerSchema } from './customer'
import { routeDetailSchema } from './route'

// Snapshot de sync do app do Vendedor (#27): o que ele precisa para trabalhar offline.

/**
 * Prospecção do próprio Vendedor: um Cliente de origem `prospect`. O `status` diz onde ela está
 * (Pendente de aprovação, aprovada = `active`, Rejeitada) e `rejectionReason` o motivo da recusa.
 * Prospecção não entra em rota nem recebe Pedido (RN04).
 */
export const prospectSchema = customerSchema.refine((customer) => customer.origin === 'prospect', {
  message: 'Só uma Prospecção entra nesta lista',
})
export type Prospect = z.infer<typeof prospectSchema>

/**
 * Resposta do GET /v1/sync/snapshot, sempre completa. Rotas de hoje e de amanhã (cada Visita já
 * traz o Cliente), raio do Check-in e Prospecções do próprio Vendedor. Comodatos e Produtos
 * entram quando essas tabelas existirem.
 */
export const syncSnapshotSchema = z.object({
  /** Quando o servidor montou o snapshot. */
  generatedAt: instanteSchema,
  checkinRadiusMeters: z.number().int().positive(),
  routes: z.array(routeDetailSchema),
  prospects: z.array(prospectSchema),
})
export type SyncSnapshot = z.infer<typeof syncSnapshotSchema>
