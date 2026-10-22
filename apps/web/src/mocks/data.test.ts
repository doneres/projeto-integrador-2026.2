import { clienteSchema } from '@axis/contracts'
import { describe, expect, it } from 'vitest'
import { clientesMock } from './data'

describe('dados da API simulada', () => {
  it.each(clientesMock)('o cliente $nomeFantasia segue o contrato', (cliente) => {
    expect(clienteSchema.safeParse(cliente).success).toBe(true)
  })
})
