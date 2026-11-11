import { describe, expect, it } from 'vitest'
import { centavosParaReais, reaisParaCentavos, validarDadosProduto } from './formulario'

describe('formulario de produtos', () => {
  it('centavosParaReais formata centavos em string pt-BR com vírgula', () => {
    expect(centavosParaReais(450)).toBe('4,50')
    expect(centavosParaReais(120000)).toBe('1200,00')
    expect(centavosParaReais(99)).toBe('0,99')
  })

  it('reaisParaCentavos converte valores com vírgula ou ponto em centavos inteiros', () => {
    expect(reaisParaCentavos('4,50')).toBe(450)
    expect(reaisParaCentavos('4.50')).toBe(450)
    expect(reaisParaCentavos('R$ 14,90')).toBe(1490)
    expect(reaisParaCentavos('1.250,50')).toBe(125050)
    expect(reaisParaCentavos('abc')).toBe(0)
  })

  it('validarDadosProduto aceita dados válidos e converte campos', () => {
    const { dados, erros } = validarDadosProduto({
      sku: 'cerv-pil-350',
      name: 'Cerveja Pilsen',
      category: 'Cervejas',
      preco: '4,50',
      referenceStock: '100',
      imageUrl: 'https://example.com/foto.jpg',
    })

    expect(erros).toEqual({})
    expect(dados).toEqual({
      sku: 'CERV-PIL-350',
      name: 'Cerveja Pilsen',
      category: 'Cervejas',
      unitPriceCents: 450,
      referenceStock: 100,
      imageUrl: 'https://example.com/foto.jpg',
    })
  })

  it('validarDadosProduto aponta erros de validação quando campos estão inválidos', () => {
    const { dados, erros } = validarDadosProduto({
      sku: '',
      name: '',
      category: '',
      preco: '0,00',
      referenceStock: '-5',
      imageUrl: 'invalido',
    })

    expect(dados).toBeUndefined()
    expect(erros.sku).toBeTruthy()
    expect(erros.name).toBeTruthy()
    expect(erros.category).toBeTruthy()
    expect(erros.unitPriceCents).toBe('O preço deve ser maior que zero')
    expect(erros.referenceStock).toBe('O estoque não pode ser negativo')
    expect(erros.imageUrl).toBeTruthy()
  })
})
