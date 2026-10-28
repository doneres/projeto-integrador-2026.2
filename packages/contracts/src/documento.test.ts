import { describe, expect, it } from 'vitest'
import {
  apenasDigitos,
  cnpjValido,
  cpfValido,
  documentoSchema,
  normalizarDocumento,
} from './documento'

describe('cpfValido', () => {
  it('aceita um CPF com os dígitos verificadores corretos', () => {
    expect(cpfValido('12345678909')).toBe(true)
  })

  it('recusa um CPF com dígito verificador errado', () => {
    expect(cpfValido('12345678900')).toBe(false)
  })

  it('recusa CPF com todos os dígitos iguais', () => {
    expect(cpfValido('11111111111')).toBe(false)
  })
})

describe('cnpjValido', () => {
  it('aceita um CNPJ numérico válido', () => {
    expect(cnpjValido('11222333000181')).toBe(true)
  })

  it('aceita um CNPJ alfanumérico válido (formato emitido desde julho de 2026)', () => {
    expect(cnpjValido('12ABC34501DE35')).toBe(true)
  })

  it('recusa um CNPJ com dígito verificador errado', () => {
    expect(cnpjValido('11222333000180')).toBe(false)
  })

  it('recusa letras nos dígitos verificadores', () => {
    expect(cnpjValido('12ABC34501DEAB')).toBe(false)
  })

  it('recusa CNPJ com todos os caracteres iguais', () => {
    expect(cnpjValido('00000000000000')).toBe(false)
  })
})

describe('normalizarDocumento', () => {
  it('remove a máscara do CNPJ e passa as letras para maiúsculas', () => {
    expect(normalizarDocumento('12.abc.345/01de-35')).toBe('12ABC34501DE35')
  })

  it('remove a máscara do CPF', () => {
    expect(normalizarDocumento('123.456.789-09')).toBe('12345678909')
  })
})

describe('apenasDigitos', () => {
  it('mantém só os dígitos do telefone', () => {
    expect(apenasDigitos('(62) 99999-0000')).toBe('62999990000')
  })
})

describe('documentoSchema', () => {
  it('aceita CPF e CNPJ sem máscara', () => {
    expect(documentoSchema.safeParse('12345678909').success).toBe(true)
    expect(documentoSchema.safeParse('12ABC34501DE35').success).toBe(true)
  })

  it('recusa documento com máscara, que deve ser normalizado antes', () => {
    expect(documentoSchema.safeParse('123.456.789-09').success).toBe(false)
  })

  it('explica o erro em português', () => {
    const { error } = documentoSchema.safeParse('12345678900')
    expect(error?.issues[0]?.message).toBe('CPF ou CNPJ inválido. Confira os dígitos.')
  })
})
