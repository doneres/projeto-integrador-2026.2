import { describe, expect, it } from 'vitest'
import { centavosParaReais, reaisParaCentavos, validarDadosMeta } from './formulario'

describe('reaisParaCentavos', () => {
  it('converte string em reais com vírgula para centavos', () => {
    expect(reaisParaCentavos('15.000,00')).toBe(1500000)
    expect(reaisParaCentavos('1500,50')).toBe(150050)
  })

  it('converte string em reais com ponto para centavos', () => {
    expect(reaisParaCentavos('1500.50')).toBe(150050)
  })

  it('retorna null para string vazia', () => {
    expect(reaisParaCentavos('')).toBeNull()
    expect(reaisParaCentavos('   ')).toBeNull()
  })
})

describe('centavosParaReais', () => {
  it('formata centavos em string pt-BR', () => {
    expect(centavosParaReais(1500000)).toBe('15.000,00')
    expect(centavosParaReais(null)).toBe('')
  })
})

describe('validarDadosMeta', () => {
  it('valida meta completa com sucesso', () => {
    const { dados, erros } = validarDadosMeta({
      faturamentoReais: '10.000,00',
      visitas: '30',
      novosClientes: '4',
    })
    expect(erros).toEqual({})
    expect(dados).toEqual({
      revenueTargetCents: 1000000,
      visitsTarget: 30,
      newCustomersTarget: 4,
    })
  })

  it('permite campos vazios como metas parciais nulas', () => {
    const { dados, erros } = validarDadosMeta({
      faturamentoReais: '',
      visitas: '25',
      novosClientes: '',
    })
    expect(erros).toEqual({})
    expect(dados).toEqual({
      revenueTargetCents: null,
      visitsTarget: 25,
      newCustomersTarget: null,
    })
  })

  it('retorna erro em valores numéricos negativos ou inválidos', () => {
    const { dados, erros } = validarDadosMeta({
      faturamentoReais: 'abc',
      visitas: '-5',
      novosClientes: 'xyz',
    })
    expect(dados).toBeUndefined()
    expect(erros.visitsTarget).toBeDefined()
    expect(erros.newCustomersTarget).toBeDefined()
  })
})
