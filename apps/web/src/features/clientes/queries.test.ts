import { describe, expect, it } from 'vitest'
import { paraQueryString } from './queries'

describe('paraQueryString', () => {
  it('monta a query com a paginação e os filtros preenchidos', () => {
    expect(paraQueryString({ page: 2, perPage: 10, search: 'padaria', status: 'active' })).toBe(
      'page=2&perPage=10&search=padaria&status=active',
    )
  })

  it('deixa de fora os filtros vazios', () => {
    expect(paraQueryString({ page: 1, perPage: 10, search: '', district: undefined })).toBe(
      'page=1&perPage=10',
    )
  })
})
