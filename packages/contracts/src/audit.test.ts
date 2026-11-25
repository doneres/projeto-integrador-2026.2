import { describe, expect, it } from 'vitest'
import { type AuditItemDetail, rn03Violations } from './audit'

const id = (n: number) => `0192f4a0-0000-7000-8000-${String(n).padStart(12, '0')}`
const NOW = '2026-11-10T13:00:00Z'

const item = (
  n: number,
  condition: AuditItemDetail['condition'],
  justification: string | null = null,
) =>
  ({ id: id(n), condition, justification }) as Pick<
    AuditItemDetail,
    'id' | 'condition' | 'justification'
  >
const photo = (n: number, auditItemId: string | null) => ({
  id: id(100 + n),
  visitId: id(1),
  auditItemId,
  storageKey: 'photos/a.jpg',
  takenAt: NOW,
  createdAt: NOW,
})
const audit = (items: ReturnType<typeof item>[], photos: ReturnType<typeof photo>[]) => ({
  items: items as AuditItemDetail[],
  photos,
})

describe('rn03Violations', () => {
  it('Visita sem Auditoria não tem exigência', () => {
    expect(rn03Violations(audit([], []))).toEqual([])
  })

  it('cumpre: uma Foto da Visita e uma por item Avariado ou em Manutenção', () => {
    expect(
      rn03Violations(
        audit(
          [item(10, 'damaged'), item(11, 'needs_maintenance'), item(12, 'intact')],
          [photo(1, null), photo(2, id(10)), photo(3, id(11))],
        ),
      ),
    ).toEqual([])
  })

  it('aponta Visita auditada sem Foto', () => {
    expect(rn03Violations(audit([item(10, 'intact')], []))).toEqual([
      'Visita auditada sem nenhuma Foto',
    ])
  })

  it('aponta item Avariado sem a Foto dele, mesmo havendo Foto da Visita', () => {
    const problems = rn03Violations(audit([item(10, 'damaged')], [photo(1, null)]))
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('damaged')
  })

  it('aponta item Ausente sem justificativa', () => {
    const problems = rn03Violations(audit([item(10, 'missing')], [photo(1, null)]))
    expect(problems[0]).toContain('sem justificativa')
    expect(rn03Violations(audit([item(10, 'missing', 'Retirado')], [photo(1, null)]))).toEqual([])
  })
})
