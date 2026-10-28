import { describe, expect, it } from 'vitest'
import { paraQueryString } from './queries'

describe('paraQueryString', () => {
  it('monta a query com a paginação e os filtros preenchidos', () => {
    expect(paraQueryString({ pagina: 2, porPagina: 10, busca: 'padaria', status: 'ativo' })).toBe(
      'pagina=2&porPagina=10&busca=padaria&status=ativo',
    )
  })

  it('deixa de fora os filtros vazios', () => {
    expect(paraQueryString({ pagina: 1, porPagina: 10, busca: '', bairro: undefined })).toBe(
      'pagina=1&porPagina=10',
    )
  })
})
