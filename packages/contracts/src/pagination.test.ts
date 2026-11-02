import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { pageOf, paginationSchema } from './pagination'

describe('paginationSchema', () => {
  it('usa page=1 e perPage=20 por padrão', () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, perPage: 20 })
  })

  it('converte a query string em números', () => {
    expect(paginationSchema.parse({ page: '3', perPage: '50' })).toEqual({ page: 3, perPage: 50 })
  })

  it('recusa página zero e mais de 100 itens por página', () => {
    expect(paginationSchema.safeParse({ page: '0' }).success).toBe(false)
    expect(paginationSchema.safeParse({ perPage: '101' }).success).toBe(false)
  })
})

describe('pageOf', () => {
  const schema = pageOf(z.string())

  it('aceita o envelope de uma página', () => {
    expect(schema.safeParse({ items: ['a'], total: 1, page: 1, perPage: 20 }).success).toBe(true)
  })

  it('recusa o envelope antigo em português', () => {
    expect(schema.safeParse({ itens: ['a'], total: 1, pagina: 1, porPagina: 20 }).success).toBe(
      false,
    )
  })
})
