import { isLoanActive, loanFiltersSchema, posMaterialFiltersSchema } from '@axis/contracts'
import { describe, expect, it } from 'vitest'
import { paraQueryString } from '../clientes/queries'

describe('materiais e comodatos: regras e filtros (RF16, RF17)', () => {
  it('posMaterialFiltersSchema: aplica ordenação padrão por nome asc', () => {
    const filtros = posMaterialFiltersSchema.parse({
      search: 'geladeira',
      active: 'true',
    })

    expect(filtros.search).toBe('geladeira')
    expect(filtros.active).toBe(true)
    expect(filtros.sortBy).toBe('name')
    expect(filtros.order).toBe('asc')
  })

  it('loanFiltersSchema: aplica ordenação padrão por installedAt desc', () => {
    const filtros = loanFiltersSchema.parse({
      activeOnly: 'true',
      search: 'GEL-001',
    })

    expect(filtros.activeOnly).toBe(true)
    expect(filtros.search).toBe('GEL-001')
    expect(filtros.sortBy).toBe('installedAt')
    expect(filtros.order).toBe('desc')
  })

  it('isLoanActive: identifica comodatos ativos e encerrados', () => {
    expect(isLoanActive({ endedAt: null })).toBe(true)
    expect(isLoanActive({ endedAt: '2026-11-01' })).toBe(false)
  })

  it('paraQueryString: converte filtros em query string sem parâmetros vazios', () => {
    const qs = paraQueryString({
      search: 'freezer',
      category: '',
      active: true,
      emptyField: undefined,
    })
    expect(qs).toBe('search=freezer&active=true')
  })
})
