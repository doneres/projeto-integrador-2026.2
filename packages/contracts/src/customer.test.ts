import { describe, expect, it } from 'vitest'
import {
  type Customer,
  customerFiltersSchema,
  customerInputSchema,
  customerRejectionSchema,
  customerSchema,
  customerStatusChangeSchema,
} from './customer'

// Dados fictícios.
const customer: Customer = {
  id: '0192f4a0-7c1e-7d2a-9b3c-4d5e6f708192',
  legalName: 'Comércio Exemplo Ltda',
  tradeName: 'Mercadinho Exemplo',
  document: '12345678000195',
  phone: '62999990000',
  contactName: 'Maria (compras)',
  zipCode: '74000000',
  street: 'Rua Exemplo',
  number: '100',
  complement: null,
  district: 'Setor Central',
  city: 'Goiânia',
  state: 'GO',
  latitude: -16.6869,
  longitude: -49.2648,
  origin: 'portfolio',
  status: 'active',
  coordinatorId: '0192f4a0-0000-7000-8000-0000000000b2',
  createdById: '0192f4a0-0000-7000-8000-0000000000b2',
  approvedById: null,
  approvedAt: null,
  rejectionReason: null,
  createdAt: '2026-11-02T12:00:00Z',
  updatedAt: '2026-11-02T12:00:00Z',
}

describe('customerSchema', () => {
  it('aceita um cliente de carteira ativo', () => {
    expect(customerSchema.safeParse(customer).success).toBe(true)
  })

  it('aceita uma prospecção pendente de aprovação', () => {
    const prospect = { ...customer, origin: 'prospect', status: 'pending_approval' }
    expect(customerSchema.safeParse(prospect).success).toBe(true)
  })

  it.each(['pending_approval', 'active', 'rejected', 'inactive'])(
    'aceita o estado %s',
    (status) => {
      const input = {
        ...customer,
        status,
        rejectionReason: status === 'rejected' ? 'Duplicado' : null,
      }
      expect(customerSchema.safeParse(input).success).toBe(true)
    },
  )

  it('recusa estado e origem fora do modelo, inclusive os nomes antigos', () => {
    expect(customerSchema.safeParse({ ...customer, status: 'ativo' }).success).toBe(false)
    expect(customerSchema.safeParse({ ...customer, origin: 'carteira' }).success).toBe(false)
  })

  it('exige a localização do cliente', () => {
    const { latitude: _, ...withoutLatitude } = customer
    expect(customerSchema.safeParse(withoutLatitude).success).toBe(false)
    expect(customerSchema.safeParse({ ...customer, longitude: null }).success).toBe(false)
  })

  it('recusa coordenadas fora do globo', () => {
    expect(customerSchema.safeParse({ ...customer, latitude: -95 }).success).toBe(false)
    expect(customerSchema.safeParse({ ...customer, longitude: 181 }).success).toBe(false)
  })

  it('exige o motivo quando a prospecção foi rejeitada', () => {
    const rejected = { ...customer, origin: 'prospect', status: 'rejected' }

    const semMotivo = customerSchema.safeParse(rejected)
    expect(semMotivo.success).toBe(false)
    expect(semMotivo.error?.issues[0]?.path).toEqual(['rejectionReason'])
    expect(
      customerSchema.safeParse({ ...rejected, rejectionReason: 'Fora da região' }).success,
    ).toBe(true)
  })

  it('recusa documento com dígito verificador errado e CEP com máscara', () => {
    expect(customerSchema.safeParse({ ...customer, document: '12345678000100' }).success).toBe(
      false,
    )
    expect(customerSchema.safeParse({ ...customer, zipCode: '74000-000' }).success).toBe(false)
  })
})

describe('customerInputSchema', () => {
  const { id: _id, status: _status, origin: _origin, ...fields } = customer
  const input = {
    legalName: fields.legalName,
    tradeName: fields.tradeName,
    document: fields.document,
    phone: fields.phone,
    contactName: fields.contactName,
    zipCode: fields.zipCode,
    street: fields.street,
    number: fields.number,
    district: fields.district,
    city: fields.city,
    state: fields.state,
    latitude: fields.latitude,
    longitude: fields.longitude,
  }

  it('aceita os dados de cadastro, sem id, origem nem estado', () => {
    expect(customerInputSchema.safeParse(input).success).toBe(true)
  })

  it('exige as coordenadas no cadastro', () => {
    const { latitude: _l, longitude: _g, ...withoutLocation } = input
    expect(customerInputSchema.safeParse(withoutLocation).success).toBe(false)
  })

  it('ignora campos que o cliente não pode definir', () => {
    const parsed = customerInputSchema.parse({ ...input, status: 'active', origin: 'portfolio' })
    expect(parsed).not.toHaveProperty('status')
    expect(parsed).not.toHaveProperty('origin')
  })
})

describe('customerStatusChangeSchema', () => {
  it('só inativa ou reativa', () => {
    expect(customerStatusChangeSchema.safeParse({ status: 'inactive' }).success).toBe(true)
    expect(customerStatusChangeSchema.safeParse({ status: 'active' }).success).toBe(true)
    expect(customerStatusChangeSchema.safeParse({ status: 'rejected' }).success).toBe(false)
  })
})

describe('customerRejectionSchema', () => {
  it('exige o motivo da rejeição', () => {
    expect(customerRejectionSchema.safeParse({ reason: 'Duplicado' }).success).toBe(true)
    expect(customerRejectionSchema.safeParse({ reason: '  ' }).success).toBe(false)
  })
})

describe('customerFiltersSchema', () => {
  it('combina paginação em inglês com os filtros', () => {
    expect(
      customerFiltersSchema.parse({ status: 'active', origin: 'prospect', page: '2' }),
    ).toEqual({
      status: 'active',
      origin: 'prospect',
      page: 2,
      perPage: 20,
      sortBy: 'tradeName',
      order: 'asc',
    })
  })

  it('ordena por nome fantasia crescente por padrão e aceita outro campo e sentido', () => {
    expect(customerFiltersSchema.parse({})).toMatchObject({ sortBy: 'tradeName', order: 'asc' })
    expect(customerFiltersSchema.parse({ sortBy: 'createdAt', order: 'desc' })).toMatchObject({
      sortBy: 'createdAt',
      order: 'desc',
    })
  })

  it('recusa ordenar por um campo que não existe', () => {
    expect(customerFiltersSchema.safeParse({ sortBy: 'document' }).success).toBe(false)
    expect(customerFiltersSchema.safeParse({ order: 'up' }).success).toBe(false)
  })
})

describe('customerSchema: aprovação e rejeição', () => {
  const approved = {
    ...customer,
    origin: 'prospect' as const,
    approvedById: '0192f4a0-0000-7000-8000-0000000000b2',
    approvedAt: '2026-11-03T12:00:00Z',
  }

  it('a aprovação grava quem aprovou e quando, juntos', () => {
    expect(customerSchema.safeParse(approved).success).toBe(true)
    expect(customerSchema.safeParse({ ...approved, approvedAt: null }).success).toBe(false)
    expect(customerSchema.safeParse({ ...approved, approvedById: null }).success).toBe(false)
  })

  it('o motivo da rejeição só existe em prospecção rejeitada', () => {
    expect(customerSchema.safeParse({ ...customer, rejectionReason: 'Duplicado' }).success).toBe(
      false,
    )
  })
})
