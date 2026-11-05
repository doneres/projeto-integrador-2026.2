import { describe, expect, it } from 'vitest'
import { progressoDaRota, resumoDoProgresso } from './progresso'

describe('progresso da rota', () => {
  it('conta as visitas por estado', () => {
    const progresso = progressoDaRota([
      { status: 'completed' },
      { status: 'completed' },
      { status: 'in_progress' },
      { status: 'not_performed' },
      { status: 'pending' },
    ])
    expect(progresso).toEqual({
      total: 5,
      completed: 2,
      in_progress: 1,
      not_performed: 1,
      pending: 1,
    })
    expect(resumoDoProgresso(progresso)).toBe(
      '2 de 5 concluídas · 1 em andamento · 1 não realizada',
    )
  })

  it('omite as contagens zeradas', () => {
    expect(resumoDoProgresso(progressoDaRota([{ status: 'pending' }]))).toBe('0 de 1 concluída')
  })
})
