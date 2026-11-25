import { describe, expect, it } from 'vitest'
import {
  type Product,
  productFiltersSchema,
  productInputSchema,
  productSchema,
  productStatusChangeSchema,
} from './product'

const produtoValido: Product = {
  id: '0192f4a0-0000-7000-8000-0000000000d1',
  sku: 'CERV-PIL-350',
  name: 'Cerveja Pilsen 350ml',
  category: 'Cervejas',
  unitPriceCents: 450,
  referenceStock: 120,
  imageUrl: 'https://example.com/pilsen.png',
  active: true,
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
}

describe('productSchema', () => {
  it('aceita um produto válido', () => {
    expect(productSchema.safeParse(produtoValido).success).toBe(true)
  })

  it('recusa produto sem SKU ou com SKU vazio', () => {
    expect(productSchema.safeParse({ ...produtoValido, sku: '' }).success).toBe(false)
    expect(productSchema.safeParse({ ...produtoValido, sku: '   ' }).success).toBe(false)
  })

  it('recusa preço negativo', () => {
    expect(productSchema.safeParse({ ...produtoValido, unitPriceCents: -10 }).success).toBe(false)
  })

  it('recusa estoque de referência negativo', () => {
    expect(productSchema.safeParse({ ...produtoValido, referenceStock: -5 }).success).toBe(false)
  })

  it('aceita imageUrl nula', () => {
    expect(productSchema.safeParse({ ...produtoValido, imageUrl: null }).success).toBe(true)
  })

  it('recusa imageUrl inválida', () => {
    expect(productSchema.safeParse({ ...produtoValido, imageUrl: 'nao-e-url' }).success).toBe(false)
  })
})

describe('productInputSchema', () => {
  const { id: _, active: _a, createdAt: _c, updatedAt: _u, ...input } = produtoValido

  it('aceita dados válidos de cadastro/edição', () => {
    expect(productInputSchema.safeParse(input).success).toBe(true)
  })

  it('recusa preço zero ou negativo no cadastro', () => {
    expect(productInputSchema.safeParse({ ...input, unitPriceCents: 0 }).success).toBe(false)
    expect(productInputSchema.safeParse({ ...input, unitPriceCents: -50 }).success).toBe(false)
  })
})

describe('productStatusChangeSchema', () => {
  it('aceita alteração de status booleano', () => {
    expect(productStatusChangeSchema.safeParse({ active: false }).success).toBe(true)
    expect(productStatusChangeSchema.safeParse({ active: true }).success).toBe(true)
  })

  it('recusa valores não booleanos', () => {
    expect(productStatusChangeSchema.safeParse({ active: 'inativo' }).success).toBe(false)
  })
})

describe('productFiltersSchema', () => {
  it('aplica valores padrão de paginação e ordenação', () => {
    const filtros = productFiltersSchema.parse({})
    expect(filtros.page).toBe(1)
    expect(filtros.perPage).toBe(20)
    expect(filtros.sortBy).toBe('name')
    expect(filtros.order).toBe('asc')
  })

  it('converte active=true da URL em booleano true', () => {
    const filtros = productFiltersSchema.parse({ active: 'true' })
    expect(filtros.active).toBe(true)
  })

  it('converte active=false da URL em booleano false', () => {
    const filtros = productFiltersSchema.parse({ active: 'false' })
    expect(filtros.active).toBe(false)
  })
})
