import { describe, expect, it } from 'vitest'
import {
  isLoanActive,
  type Loan,
  loanEndSchema,
  loanFiltersSchema,
  loanInputSchema,
  loanSchema,
  type PosMaterial,
  posMaterialFiltersSchema,
  posMaterialInputSchema,
  posMaterialSchema,
  posMaterialStatusChangeSchema,
} from './pos-material'

const materialValido: PosMaterial = {
  id: '0192f4a0-0000-7000-8000-0000000000b1',
  name: 'Geladeira Expositora 2 Portas',
  category: 'Geladeiras',
  active: true,
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
}

const comodatoValido: Loan = {
  id: '0192f4a0-0000-7000-8000-0000000000c1',
  materialId: '0192f4a0-0000-7000-8000-0000000000b1',
  customerId: '0192f4a0-0000-7000-8000-000000000001',
  serialNumber: 'GEL-2026-0042',
  installedAt: '2026-10-10',
  endedAt: null,
  createdAt: '2026-10-10T14:00:00Z',
  updatedAt: '2026-10-10T14:00:00Z',
}

describe('posMaterialSchema', () => {
  it('aceita material válido', () => {
    expect(posMaterialSchema.safeParse(materialValido).success).toBe(true)
  })

  it('recusa material sem nome ou com nome em branco', () => {
    expect(posMaterialSchema.safeParse({ ...materialValido, name: '' }).success).toBe(false)
    expect(posMaterialSchema.safeParse({ ...materialValido, name: '   ' }).success).toBe(false)
  })

  it('recusa material sem categoria', () => {
    expect(posMaterialSchema.safeParse({ ...materialValido, category: '' }).success).toBe(false)
  })
})

describe('posMaterialInputSchema', () => {
  it('aceita input válido', () => {
    expect(
      posMaterialInputSchema.safeParse({
        name: 'Freezer Vertical',
        category: 'Freezers',
      }).success,
    ).toBe(true)
  })

  it('recusa nome acima do tamanho máximo de 150 caracteres', () => {
    expect(
      posMaterialInputSchema.safeParse({
        name: 'a'.repeat(151),
        category: 'Freezers',
      }).success,
    ).toBe(false)
  })
})

describe('posMaterialStatusChangeSchema', () => {
  it('aceita ativação e inativação', () => {
    expect(posMaterialStatusChangeSchema.safeParse({ active: false }).success).toBe(true)
    expect(posMaterialStatusChangeSchema.safeParse({ active: true }).success).toBe(true)
  })

  it('recusa valores não booleanos', () => {
    expect(posMaterialStatusChangeSchema.safeParse({ active: 'false' }).success).toBe(false)
  })
})

describe('posMaterialFiltersSchema', () => {
  it('aplica paginação padrão', () => {
    const filtros = posMaterialFiltersSchema.parse({})
    expect(filtros.page).toBe(1)
    expect(filtros.perPage).toBe(20)
    expect(filtros.sortBy).toBe('name')
    expect(filtros.order).toBe('asc')
  })

  it('converte active=true da query em booleano', () => {
    const filtros = posMaterialFiltersSchema.parse({ active: 'true' })
    expect(filtros.active).toBe(true)
  })
})

describe('loanSchema', () => {
  it('aceita comodato ativo válido', () => {
    expect(loanSchema.safeParse(comodatoValido).success).toBe(true)
  })

  it('aceita comodato encerrado com endedAt preenchido', () => {
    const encerrado = { ...comodatoValido, endedAt: '2026-11-01' }
    expect(loanSchema.safeParse(encerrado).success).toBe(true)
  })

  it('recusa serialNumber vazio', () => {
    expect(loanSchema.safeParse({ ...comodatoValido, serialNumber: '  ' }).success).toBe(false)
  })

  it('recusa formato de data inválido', () => {
    expect(loanSchema.safeParse({ ...comodatoValido, installedAt: '10/10/2026' }).success).toBe(
      false,
    )
  })
})

describe('loanInputSchema', () => {
  it('aceita input válido de cadastro de comodato', () => {
    expect(
      loanInputSchema.safeParse({
        materialId: comodatoValido.materialId,
        customerId: comodatoValido.customerId,
        serialNumber: 'SN-9988-ABC',
        installedAt: '2026-10-15',
      }).success,
    ).toBe(true)
  })
})

describe('loanEndSchema', () => {
  it('aceita data de encerramento válida', () => {
    expect(loanEndSchema.safeParse({ endedAt: '2026-11-10' }).success).toBe(true)
  })

  it('recusa data inválida', () => {
    expect(loanEndSchema.safeParse({ endedAt: 'nao-e-data' }).success).toBe(false)
  })
})

describe('loanFiltersSchema', () => {
  it('aplica paginação padrão e ordenação por installedAt desc', () => {
    const filtros = loanFiltersSchema.parse({})
    expect(filtros.page).toBe(1)
    expect(filtros.perPage).toBe(20)
    expect(filtros.sortBy).toBe('installedAt')
    expect(filtros.order).toBe('desc')
  })

  it('converte activeOnly=true em booleano', () => {
    const filtros = loanFiltersSchema.parse({ activeOnly: 'true' })
    expect(filtros.activeOnly).toBe(true)
  })
})

describe('isLoanActive', () => {
  it('retorna true quando endedAt é null', () => {
    expect(isLoanActive({ endedAt: null })).toBe(true)
  })

  it('retorna false quando endedAt tem data', () => {
    expect(isLoanActive({ endedAt: '2026-11-01' })).toBe(false)
  })
})
