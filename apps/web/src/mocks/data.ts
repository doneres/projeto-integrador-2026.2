import type { Cliente } from '../features/clientes/types'

// Dados fictícios para desenvolvimento. Não usar dados reais de clientes aqui.
export const clientesMock: Cliente[] = [
  {
    id: '1',
    nome: 'Mercadinho Exemplo Norte',
    cidade: 'Goiânia',
    cep: '74000-000',
    status: 'ativo',
  },
  { id: '2', nome: 'Padaria Modelo Sul', cidade: 'Goiânia', cep: '74100-000', status: 'ativo' },
  {
    id: '3',
    nome: 'Loja Teste Centro',
    cidade: 'Aparecida de Goiânia',
    cep: '74900-000',
    status: 'inativo',
  },
]
