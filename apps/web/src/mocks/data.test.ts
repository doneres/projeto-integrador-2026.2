import { customerSchema, routeSchema, visitSchema } from '@axis/contracts'
import { describe, expect, it } from 'vitest'
import { clientesMock, rotasMock, visitasMock } from './data'

describe('dados da API simulada', () => {
  it.each(clientesMock)('o cliente $tradeName segue o contrato', (cliente) => {
    expect(customerSchema.safeParse(cliente).success).toBe(true)
  })

  it.each(rotasMock)('a rota $id segue o contrato', (rota) => {
    expect(routeSchema.safeParse(rota).success).toBe(true)
  })

  it.each(visitasMock)('a visita $id segue o contrato', (visita) => {
    expect(visitSchema.safeParse(visita).success).toBe(true)
  })
})
