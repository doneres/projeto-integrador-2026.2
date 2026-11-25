import { describe, expect, it } from 'vitest'
import { createOrderBodySchema, orderTotalCents } from './order'

const id = (n: number) => `0192f4a0-0000-7000-8000-${String(n).padStart(12, '0')}`

describe('orderTotalCents', () => {
  it('soma quantidade vezes o preço congelado de cada item', () => {
    expect(
      orderTotalCents([
        { quantity: 3, unitPriceCents: 949 },
        { quantity: 10, unitPriceCents: 249 },
      ]),
    ).toBe(5337)
    expect(orderTotalCents([])).toBe(0)
  })
})

describe('createOrderBodySchema', () => {
  const visitId = id(1)

  it('aceita itens distintos e não recebe preço no corpo', () => {
    const parsed = createOrderBodySchema.parse({
      visitId,
      items: [{ productId: id(2), quantity: 2, unitPriceCents: 1 }],
    })
    expect(parsed.items[0]).toEqual({ productId: id(2), quantity: 2 })
  })

  it('recusa lista vazia, produto repetido e quantidade zero', () => {
    const invalid = [
      [],
      [
        { productId: id(2), quantity: 1 },
        { productId: id(2), quantity: 2 },
      ],
      [{ productId: id(2), quantity: 0 }],
    ]
    for (const items of invalid) {
      expect(createOrderBodySchema.safeParse({ visitId, items }).success).toBe(false)
    }
  })
})
