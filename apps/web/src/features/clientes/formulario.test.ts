import { customerInputSchema } from '@axis/contracts'
import { describe, expect, it } from 'vitest'
import { clientesMock } from '../../mocks/data'
import { formularioClienteSchema, valoresDoCliente } from './formulario'

const valoresDigitados = {
  legalName: ' Comércio Exemplo Ltda ',
  tradeName: 'Mercadinho Exemplo',
  document: '12.abc.345/01de-35',
  phone: '(62) 99999-0000',
  contactName: 'Maria',
  zipCode: '74000-000',
  street: 'Rua Exemplo',
  number: '100',
  complement: '',
  district: 'Setor Central',
  city: 'Goiânia',
  state: 'go',
  latitude: '-16,6869',
  longitude: '-49.2648',
}

describe('formularioClienteSchema', () => {
  it('aceita o que o usuário digita e entrega os dados no formato do contrato', () => {
    const dados = formularioClienteSchema.parse(valoresDigitados)
    expect(dados).toEqual({
      legalName: 'Comércio Exemplo Ltda',
      tradeName: 'Mercadinho Exemplo',
      document: '12ABC34501DE35',
      phone: '62999990000',
      contactName: 'Maria',
      zipCode: '74000000',
      street: 'Rua Exemplo',
      number: '100',
      complement: undefined,
      district: 'Setor Central',
      city: 'Goiânia',
      state: 'GO',
      latitude: -16.6869,
      longitude: -49.2648,
    })
    expect(customerInputSchema.safeParse(dados).success).toBe(true)
  })

  it('recusa CPF com dígito verificador errado', () => {
    const { error } = formularioClienteSchema.safeParse({
      ...valoresDigitados,
      document: '123.456.789-00',
    })
    expect(error?.issues[0]?.message).toBe('CPF ou CNPJ inválido. Confira os dígitos.')
  })

  it('explica quando a latitude não é um número', () => {
    const { error } = formularioClienteSchema.safeParse({ ...valoresDigitados, latitude: 'abc' })
    expect(error?.issues[0]?.message).toBe('A latitude deve ser um número. Ex.: -16.6869')
  })
})

describe('valoresDoCliente', () => {
  it('devolve os mesmos dados ao editar e salvar sem mudanças', () => {
    const cliente = clientesMock[1]
    const valores = formularioClienteSchema.parse(valoresDoCliente(cliente))
    const esperado = customerInputSchema.parse({
      ...cliente,
      complement: cliente.complement ?? undefined,
    })
    expect(valores).toEqual(esperado)
  })
})
