import { customerFiltersSchema, customerRejectionSchema } from '@axis/contracts'
import { describe, expect, it } from 'vitest'

describe('prospeccoes: regras e validações (RF09, RN04)', () => {
  it('customerRejectionSchema: exige motivo com texto e recusa em branco ou com espaços', () => {
    expect(
      customerRejectionSchema.safeParse({ reason: 'Fora do raio de atendimento' }).success,
    ).toBe(true)
    expect(customerRejectionSchema.safeParse({ reason: '' }).success).toBe(false)
    expect(customerRejectionSchema.safeParse({ reason: '    ' }).success).toBe(false)
    expect(customerRejectionSchema.safeParse({}).success).toBe(false)
  })

  it('customerRejectionSchema: limita o motivo a 500 caracteres', () => {
    const motivo500 = 'a'.repeat(500)
    expect(customerRejectionSchema.safeParse({ reason: motivo500 }).success).toBe(true)

    const motivo501 = 'a'.repeat(501)
    expect(customerRejectionSchema.safeParse({ reason: motivo501 }).success).toBe(false)
  })

  it('customerFiltersSchema: permite filtrar por status pending_approval e origin prospect', () => {
    const filtros = customerFiltersSchema.parse({
      origin: 'prospect',
      status: 'pending_approval',
      search: 'cantina',
    })

    expect(filtros.origin).toBe('prospect')
    expect(filtros.status).toBe('pending_approval')
    expect(filtros.search).toBe('cantina')
    expect(filtros.sortBy).toBe('tradeName')
  })
})
