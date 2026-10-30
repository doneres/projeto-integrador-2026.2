import { colors, textPairs } from './colors'
import { contrastRatio } from './contrast'

describe('contrastRatio', () => {
  it('vale 21 entre preto e branco e 1 entre cores iguais', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5)
    expect(contrastRatio('#1D4ED8', '#1D4ED8')).toBeCloseTo(1, 5)
  })

  it('não depende da ordem das cores', () => {
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(contrastRatio('#FFFFFF', '#777777'), 10)
  })
})

describe('tokens de cor (RNF03)', () => {
  it.each(textPairs)(
    'texto %s sobre %s tem contraste de pelo menos 4,5:1',
    (foreground, background) => {
      expect(contrastRatio(colors[foreground], colors[background])).toBeGreaterThanOrEqual(4.5)
    },
  )

  it('a borda dos campos tem contraste de pelo menos 3:1 com o fundo', () => {
    expect(contrastRatio(colors.border, colors.background)).toBeGreaterThanOrEqual(3)
  })
})
