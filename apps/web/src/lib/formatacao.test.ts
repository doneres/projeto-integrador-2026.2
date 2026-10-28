import { describe, expect, it } from 'vitest'
import { formatarCep, formatarDocumento, formatarTelefone } from './formatacao'

describe('formatarDocumento', () => {
  it('formata CPF', () => {
    expect(formatarDocumento('12345678909')).toBe('123.456.789-09')
  })

  it('formata CNPJ numérico e alfanumérico', () => {
    expect(formatarDocumento('12345678000195')).toBe('12.345.678/0001-95')
    expect(formatarDocumento('12ABC34501DE35')).toBe('12.ABC.345/01DE-35')
  })
})

describe('formatarCep', () => {
  it('coloca o hífen', () => {
    expect(formatarCep('74000000')).toBe('74000-000')
  })
})

describe('formatarTelefone', () => {
  it('formata celular e fixo', () => {
    expect(formatarTelefone('62999990000')).toBe('(62) 99999-0000')
    expect(formatarTelefone('6233330002')).toBe('(62) 3333-0002')
  })
})
