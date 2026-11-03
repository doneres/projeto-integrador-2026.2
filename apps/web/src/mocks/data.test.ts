import { customerSchema } from '@axis/contracts'
import { describe, expect, it } from 'vitest'
import { clientesMock } from './data'

describe('dados da API simulada', () => {
  it.each(clientesMock)('o cliente $tradeName segue o contrato', (cliente) => {
    expect(customerSchema.safeParse(cliente).success).toBe(true)
  })
})
