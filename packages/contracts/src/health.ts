import { z } from 'zod'

/** Resposta de GET /health. Não consulta o banco: só diz que o processo da API está de pé. */
export const healthSchema = z.object({
  status: z.literal('ok'),
})
export type Health = z.infer<typeof healthSchema>
