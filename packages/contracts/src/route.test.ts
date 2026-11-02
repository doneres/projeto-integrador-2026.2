import { describe, expect, it } from 'vitest'
import { createRouteBodySchema, routeFiltersSchema, routeSchema } from './route'

const route = {
  id: '0192f4a0-0000-7000-8000-0000000000d1',
  sellerId: '0192f4a0-0000-7000-8000-0000000000a1',
  date: '2026-11-03',
  createdById: '0192f4a0-0000-7000-8000-0000000000b2',
  createdAt: '2026-11-02T12:00:00Z',
  updatedAt: '2026-11-02T12:00:00Z',
}

describe('routeSchema', () => {
  it('aceita a rota de um vendedor em um dia', () => {
    expect(routeSchema.safeParse(route).success).toBe(true)
  })

  it('a data é de calendário, sem horário', () => {
    expect(routeSchema.safeParse({ ...route, date: '2026-11-03T10:00:00Z' }).success).toBe(false)
  })
})

describe('createRouteBodySchema', () => {
  const customerA = '0192f4a0-0000-7000-8000-0000000000e1'
  const customerB = '0192f4a0-0000-7000-8000-0000000000e2'
  const body = { sellerId: route.sellerId, date: route.date, customerIds: [customerA, customerB] }

  it('aceita o vendedor, o dia e os clientes na ordem das visitas', () => {
    expect(createRouteBodySchema.safeParse(body).success).toBe(true)
  })

  it('exige ao menos um cliente', () => {
    expect(createRouteBodySchema.safeParse({ ...body, customerIds: [] }).success).toBe(false)
  })

  it('recusa o mesmo cliente duas vezes na rota', () => {
    expect(
      createRouteBodySchema.safeParse({ ...body, customerIds: [customerA, customerA] }).success,
    ).toBe(false)
  })
})

describe('createRouteBodySchema: tamanho', () => {
  it('limita os clientes de uma rota a 100', () => {
    const ids = (count: number) =>
      Array.from(
        { length: count },
        (_, n) => `0192f4a0-0000-7000-8000-${String(n).padStart(12, '0')}`,
      )
    const body = { sellerId: route.sellerId, date: route.date }

    expect(createRouteBodySchema.safeParse({ ...body, customerIds: ids(100) }).success).toBe(true)
    expect(createRouteBodySchema.safeParse({ ...body, customerIds: ids(101) }).success).toBe(false)
  })
})

describe('routeFiltersSchema', () => {
  it('pagina e filtra por dia e por vendedor', () => {
    expect(routeFiltersSchema.parse({})).toEqual({ page: 1, perPage: 20 })
    expect(
      routeFiltersSchema.parse({ date: '2026-11-03', sellerId: route.sellerId, page: '2' }),
    ).toEqual({ date: '2026-11-03', sellerId: route.sellerId, page: 2, perPage: 20 })
  })

  it('recusa data com horário', () => {
    expect(routeFiltersSchema.safeParse({ date: '2026-11-03T10:00:00Z' }).success).toBe(false)
  })
})
