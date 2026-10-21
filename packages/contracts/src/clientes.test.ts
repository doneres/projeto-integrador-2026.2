import { describe, expect, it } from 'vitest'
import { type Cliente, clienteSchema, dadosClienteSchema, filtrosClientesSchema } from './clientes'

// Dados fictícios.
const clienteValido: Cliente = {
  id: '0192f4a0-7c1e-7d2a-9b3c-4d5e6f708192',
  razaoSocial: 'Comércio Exemplo Ltda',
  nomeFantasia: 'Mercadinho Exemplo',
  documento: '12345678000195',
  telefone: '62999990000',
  contato: 'Maria (compras)',
  endereco: {
    cep: '74000000',
    logradouro: 'Rua Exemplo',
    numero: '100',
    bairro: 'Setor Central',
    cidade: 'Goiânia',
    uf: 'GO',
  },
  localizacao: { latitude: -16.6869, longitude: -49.2648 },
  tipo: 'carteira',
  status: 'ativo',
  criadoEm: '2026-10-21T03:00:00Z',
  atualizadoEm: '2026-10-21T03:00:00Z',
}

describe('clienteSchema', () => {
  it('aceita um cliente com os campos da RF05', () => {
    expect(clienteSchema.safeParse(clienteValido).success).toBe(true)
  })

  it('aceita cliente com CNPJ alfanumérico', () => {
    expect(clienteSchema.safeParse({ ...clienteValido, documento: '12ABC34501DE35' }).success).toBe(
      true,
    )
  })

  it('recusa CEP com máscara', () => {
    const cliente = { ...clienteValido, endereco: { ...clienteValido.endereco, cep: '74000-000' } }
    expect(clienteSchema.safeParse(cliente).success).toBe(false)
  })

  it('recusa documento com dígito verificador errado', () => {
    expect(clienteSchema.safeParse({ ...clienteValido, documento: '12345678000100' }).success).toBe(
      false,
    )
  })

  it('recusa coordenadas fora do globo', () => {
    const cliente = { ...clienteValido, localizacao: { latitude: -95, longitude: -49.2648 } }
    expect(clienteSchema.safeParse(cliente).success).toBe(false)
  })

  it('recusa tipo de cliente fora da lista', () => {
    expect(clienteSchema.safeParse({ ...clienteValido, tipo: 'outro' }).success).toBe(false)
  })

  it('explica em português o campo obrigatório que faltou', () => {
    const { error } = clienteSchema.safeParse({ ...clienteValido, razaoSocial: '   ' })
    expect(error?.issues[0]?.message).toBe('Informe a razão social')
  })
})

describe('dadosClienteSchema', () => {
  it('não pede id, status nem datas, que são definidos pela API', () => {
    const { id, status, criadoEm, atualizadoEm, ...dados } = clienteValido
    expect(dadosClienteSchema.safeParse(dados).success).toBe(true)
  })
})

describe('filtrosClientesSchema', () => {
  it('junta paginação, busca e filtros vindos da query string', () => {
    expect(filtrosClientesSchema.parse({ busca: 'padaria', status: 'ativo', pagina: '2' })).toEqual(
      {
        pagina: 2,
        porPagina: 20,
        busca: 'padaria',
        status: 'ativo',
      },
    )
  })

  it('recusa status fora da lista', () => {
    expect(filtrosClientesSchema.safeParse({ status: 'excluido' }).success).toBe(false)
  })
})
