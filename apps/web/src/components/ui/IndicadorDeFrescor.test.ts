import { describe, expect, it } from 'vitest'
import { textoDeFrescor } from './IndicadorDeFrescor'

const INSTANTE = Date.parse('2026-11-06T13:05:09Z')

describe('textoDeFrescor', () => {
  it('não mostra hora antes da primeira busca bem-sucedida', () => {
    expect(textoDeFrescor({ atualizadoEm: 0, atualizando: true, comErro: false })).toBeNull()
  })

  it('mostra a hora da última busca bem-sucedida em São Paulo', () => {
    expect(textoDeFrescor({ atualizadoEm: INSTANTE, atualizando: false, comErro: false })).toBe(
      'Atualizado às 10:05:09',
    )
  })

  it('avisa a defasagem quando a busca falha mantendo o dado anterior', () => {
    expect(textoDeFrescor({ atualizadoEm: INSTANTE, atualizando: false, comErro: true })).toBe(
      'Atualizado às 10:05:09 · sem atualizar desde 10:05',
    )
  })
})
