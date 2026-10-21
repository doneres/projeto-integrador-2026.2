import { describe, expect, it } from 'vitest'
import { type Cliente, clienteSchema } from './clientes'

// Dados fictícios.
const clienteValido: Cliente = {
  id: '0192f4a0-7c1e-7d2a-9b3c-4d5e6f708192',
  razaoSocial: 'Comércio Exemplo Ltda',
  nomeFantasia: 'Mercadinho Exemplo',
  documento: '12345678000100',
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

  it('recusa CEP com máscara', () => {
    const cliente = { ...clienteValido, endereco: { ...clienteValido.endereco, cep: '74000-000' } }
    expect(clienteSchema.safeParse(cliente).success).toBe(false)
  })

  it('recusa documento que não é CPF nem CNPJ', () => {
    expect(clienteSchema.safeParse({ ...clienteValido, documento: '123' }).success).toBe(false)
  })

  it('recusa coordenadas fora do globo', () => {
    const cliente = { ...clienteValido, localizacao: { latitude: -95, longitude: -49.2648 } }
    expect(clienteSchema.safeParse(cliente).success).toBe(false)
  })

  it('recusa tipo de cliente fora da lista', () => {
    expect(clienteSchema.safeParse({ ...clienteValido, tipo: 'outro' }).success).toBe(false)
  })
})
