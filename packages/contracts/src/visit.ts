import { z } from 'zod'
import { idSchema, instanteSchema } from './comum'
import { latitudeSchema, longitudeSchema } from './fields'

// Visita conforme o modelo de dados (#26): a linha nasce com a rota e check-in e check-out só
// preenchem colunas dela. O estado da visita não é coluna: sai de `visitStatusOf`.

/** `on_site` é gravado, e não recalculado, porque o raio do check-in é um parâmetro e muda. */
export const checkInStatusSchema = z.enum(['on_site', 'out_of_radius'])
export type CheckInStatus = z.infer<typeof checkInStatusSchema>

export const outcomeSchema = z.enum(['sale_made', 'audit_only', 'customer_closed', 'not_performed'])
export type Outcome = z.infer<typeof outcomeSchema>

/**
 * Desfechos que fazem da Visita uma "Visita realizada". Os demais a deixam Não realizada e exigem
 * justificativa.
 */
const COMPLETING_OUTCOMES: readonly Outcome[] = ['sale_made', 'audit_only']

function needsJustification(outcome: Outcome | null): boolean {
  return outcome !== null && !COMPLETING_OUTCOMES.includes(outcome)
}

export const visitStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'not_performed'])
export type VisitStatus = z.infer<typeof visitStatusSchema>

const justificationSchema = z.string().trim().max(500, 'Use no máximo 500 caracteres')

export const visitSchema = z
  .object({
    id: idSchema,
    routeId: idSchema,
    customerId: idSchema,
    /** Ordem manual definida pelo Coordenador. */
    position: z.number().int().min(1),
    checkedInAt: instanteSchema.nullable(),
    checkInLatitude: latitudeSchema.nullable(),
    checkInLongitude: longitudeSchema.nullable(),
    checkInAccuracyMeters: z.number().min(0).nullable(),
    checkInDistanceMeters: z.number().min(0).nullable(),
    checkInStatus: checkInStatusSchema.nullable(),
    checkInJustification: justificationSchema.nullable(),
    checkedOutAt: instanteSchema.nullable(),
    outcome: outcomeSchema.nullable(),
    outcomeJustification: justificationSchema.nullable(),
    summary: z.string().trim().max(1000).nullable(),
    createdAt: instanteSchema,
    updatedAt: instanteSchema,
  })
  .superRefine((visit, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message })

    if (visit.checkedInAt) {
      const reading = [
        visit.checkInLatitude,
        visit.checkInLongitude,
        visit.checkInAccuracyMeters,
        visit.checkInDistanceMeters,
        visit.checkInStatus,
      ]
      if (reading.some((value) => value === null)) {
        issue('checkInStatus', 'O check-in grava a leitura do GPS, a distância e a situação')
      }
    }
    if (visit.checkInStatus === 'out_of_radius' && !visit.checkInJustification) {
      issue('checkInJustification', 'Informe a justificativa do check-in fora do raio')
    }
    if (visit.checkedOutAt && !visit.checkedInAt) {
      issue('checkedOutAt', 'O check-out exige check-in')
    }
    if (Boolean(visit.checkedOutAt) !== Boolean(visit.outcome)) {
      issue('outcome', 'O check-out e o desfecho são registrados juntos')
    }
    if (needsJustification(visit.outcome) && !visit.outcomeJustification) {
      issue('outcomeJustification', 'Informe a justificativa do desfecho')
    }
  })
export type Visit = z.infer<typeof visitSchema>

/**
 * Estado derivado da Visita, o mesmo nos filtros SQL e na interface:
 * Pendente (sem check-in), Em andamento (sem check-out), Concluída (venda ou apenas auditoria,
 * a "Visita realizada" da Meta) ou Não realizada (cliente fechado ou não realizada).
 */
export function visitStatusOf(
  visit: Pick<Visit, 'checkedInAt' | 'checkedOutAt' | 'outcome'>,
): VisitStatus {
  if (!visit.checkedInAt) return 'pending'
  if (!visit.checkedOutAt) return 'in_progress'
  return needsJustification(visit.outcome) ? 'not_performed' : 'completed'
}

/**
 * Corpo do check-in. A distância e a situação (`on_site` ou `out_of_radius`) são calculadas pela
 * API; a justificativa é obrigatória só quando ela resulta fora do raio.
 */
export const checkInBodySchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  accuracyMeters: z.number().min(0),
  justification: justificationSchema.optional(),
  /** Relógio do aparelho: o check-in pode ser feito offline. */
  occurredAt: instanteSchema,
})
export type CheckInBody = z.infer<typeof checkInBodySchema>

export const checkOutBodySchema = z
  .object({
    outcome: outcomeSchema,
    outcomeJustification: justificationSchema.optional(),
    summary: z.string().trim().max(1000).optional(),
    occurredAt: instanteSchema,
  })
  .superRefine((body, ctx) => {
    if (needsJustification(body.outcome) && !body.outcomeJustification) {
      ctx.addIssue({
        code: 'custom',
        path: ['outcomeJustification'],
        message: 'Informe a justificativa do desfecho',
      })
    }
  })
export type CheckOutBody = z.infer<typeof checkOutBodySchema>
