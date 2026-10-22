import { describe, expect, it } from 'vitest'
import { clientesMock } from '../../mocks/data'
import { formularioClienteSchema, paraDadosCliente, valoresDoCliente } from './formulario'

const valoresDigitados = {
  razaoSocial: ' Comércio Exemplo Ltda ',
  nomeFantasia: 'Mercadinho Exemplo',
  documento: '12.abc.345/01de-35',
  telefone: '(62) 99999-0000',
  contato: 'Maria',
  endereco: {
    cep: '74000-000',
    logradouro: 'Rua Exemplo',
    numero: '100',
    complemento: '',
    bairro: 'Setor Central',
    cidade: 'Goiânia',
    uf: 'go',
  },
  localizacao: { latitude: '-16,6869', longitude: '-49.2648' },
}

describe('formularioClienteSchema', () => {
  it('aceita o que o usuário digita e entrega os dados no formato do contrato', () => {
    expect(formularioClienteSchema.parse(valoresDigitados)).toEqual({
      razaoSocial: 'Comércio Exemplo Ltda',
      nomeFantasia: 'Mercadinho Exemplo',
      documento: '12ABC34501DE35',
      telefone: '62999990000',
      contato: 'Maria',
      endereco: {
        cep: '74000000',
        logradouro: 'Rua Exemplo',
        numero: '100',
        complemento: undefined,
        bairro: 'Setor Central',
        cidade: 'Goiânia',
        uf: 'GO',
      },
      localizacao: { latitude: -16.6869, longitude: -49.2648 },
    })
  })

  it('recusa CPF com dígito verificador errado', () => {
    const { error } = formularioClienteSchema.safeParse({
      ...valoresDigitados,
      documento: '123.456.789-00',
    })
    expect(error?.issues[0]?.message).toBe('CPF ou CNPJ inválido. Confira os dígitos.')
  })

  it('explica quando a latitude não é um número', () => {
    const { error } = formularioClienteSchema.safeParse({
      ...valoresDigitados,
      localizacao: { latitude: 'abc', longitude: '-49.2648' },
    })
    expect(error?.issues[0]?.message).toBe('A latitude deve ser um número. Ex.: -16.6869')
  })
})

describe('valoresDoCliente', () => {
  it('devolve os mesmos dados ao editar e salvar sem mudanças', () => {
    const cliente = clientesMock[1]
    const valores = formularioClienteSchema.parse(valoresDoCliente(cliente))
    const { id, status, criadoEm, atualizadoEm, ...esperado } = cliente
    expect(paraDadosCliente(valores, cliente.tipo)).toEqual(esperado)
  })
})
