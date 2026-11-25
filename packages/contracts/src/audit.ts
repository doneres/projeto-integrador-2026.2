import { z } from 'zod'
import { idSchema, instanteSchema } from './comum'
import { loanSchema, posMaterialSchema } from './pos-material'

// Auditoria de PDV e Fotos conforme o modelo de dados (#26, RF16, RF17, RN03).

/** Estado de conservação de um Comodato na Visita. */
export const conditionSchema = z.enum(['intact', 'damaged', 'missing', 'needs_maintenance'])
export type Condition = z.infer<typeof conditionSchema>

/** Estados que exigem uma Foto do item (RN03). */
export const CONDITIONS_NEEDING_PHOTO: readonly Condition[] = ['damaged', 'needs_maintenance']

export const auditItemSchema = z.object({
  id: idSchema,
  visitId: idSchema,
  loanId: idSchema,
  condition: conditionSchema,
  /** Obrigatória quando o item está Ausente. */
  justification: z.string().trim().max(500).nullable(),
  occurredAt: instanteSchema,
  createdAt: instanteSchema,
})
export type AuditItem = z.infer<typeof auditItemSchema>

export const photoSchema = z.object({
  id: idSchema,
  visitId: idSchema,
  /** Ligada ao item auditado quando a Foto o comprova. */
  auditItemId: idSchema.nullable(),
  /** Chave do arquivo no armazenamento externo. */
  storageKey: z.string().min(1),
  takenAt: instanteSchema,
  createdAt: instanteSchema,
})
export type Photo = z.infer<typeof photoSchema>

/** Um item da Auditoria com o Comodato e o Material, para a tela não precisar de outra chamada. */
export const auditItemDetailSchema = auditItemSchema.extend({
  loan: loanSchema,
  material: posMaterialSchema,
})
export type AuditItemDetail = z.infer<typeof auditItemDetailSchema>

/** Resposta do GET /v1/visits/{id}/audit: os itens auditados e as Fotos da Visita. */
export const visitAuditSchema = z.object({
  visitId: idSchema,
  items: z.array(auditItemDetailSchema),
  photos: z.array(photoSchema),
})
export type VisitAudit = z.infer<typeof visitAuditSchema>

/**
 * Confere a RN03 sobre uma Auditoria já lida: a Visita auditada tem ao menos uma Foto, cada item
 * Avariado ou que Necessita Manutenção tem a sua, e o item Ausente tem justificativa. Devolve as
 * violações, em texto; vazio = a Auditoria cumpre a regra.
 */
export function rn03Violations(audit: Pick<VisitAudit, 'items' | 'photos'>): string[] {
  if (audit.items.length === 0) return []
  const problems: string[] = []
  if (audit.photos.length === 0) problems.push('Visita auditada sem nenhuma Foto')
  const photographed = new Set(audit.photos.map((photo) => photo.auditItemId))
  for (const item of audit.items) {
    if (CONDITIONS_NEEDING_PHOTO.includes(item.condition) && !photographed.has(item.id)) {
      problems.push(`Item ${item.id} (${item.condition}) sem Foto`)
    }
    if (item.condition === 'missing' && !item.justification) {
      problems.push(`Item ${item.id} ausente sem justificativa`)
    }
  }
  return problems
}
