import type { RouteDetail } from '@axis/contracts'
import { describe, expect, it } from 'vitest'
import { flagsDeAuditoriaDasRotas, progressoDaRota, resumoDoProgresso } from './progresso'

describe('progresso da rota', () => {
  it('conta as visitas por estado e as Flags de auditoria fora do raio', () => {
    const progresso = progressoDaRota([
      { status: 'completed', checkInStatus: 'on_site' },
      { status: 'completed', checkInStatus: 'out_of_radius' },
      { status: 'in_progress', checkInStatus: 'out_of_radius' },
      { status: 'not_performed' },
      { status: 'pending' },
    ])
    expect(progresso).toEqual({
      total: 5,
      completed: 2,
      in_progress: 1,
      not_performed: 1,
      pending: 1,
      foraDoRaio: 2,
    })
    expect(resumoDoProgresso(progresso)).toBe(
      '2 de 5 concluídas · 1 em andamento · 1 não realizada',
    )
  })

  it('omite as contagens zeradas', () => {
    expect(resumoDoProgresso(progressoDaRota([{ status: 'pending' }]))).toBe('0 de 1 concluída')
  })
})

describe('flagsDeAuditoriaDasRotas', () => {
  it('junta as Visitas fora do raio das rotas carregadas e ignora as que ainda carregam', () => {
    const rota = (
      id: string,
      sellerId: string,
      situacoes: Array<'on_site' | 'out_of_radius' | null>,
    ) =>
      ({
        id,
        sellerId,
        visits: situacoes.map((checkInStatus, i) => ({ id: `${id}-${i}`, checkInStatus })),
      }) as unknown as RouteDetail

    const flags = flagsDeAuditoriaDasRotas([
      rota('r1', 'v1', ['on_site', 'out_of_radius', null]),
      undefined,
      rota('r2', 'v2', ['out_of_radius']),
    ])
    expect(flags.map((f) => [f.rotaId, f.sellerId, f.visita.id])).toEqual([
      ['r1', 'v1', 'r1-1'],
      ['r2', 'v2', 'r2-0'],
    ])
  })
})
