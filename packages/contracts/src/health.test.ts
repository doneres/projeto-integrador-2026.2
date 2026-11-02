import { describe, expect, it } from 'vitest'
import { healthSchema } from './health'

describe('healthSchema', () => {
  it('aceita a resposta de saúde', () => {
    expect(healthSchema.safeParse({ status: 'ok' }).success).toBe(true)
  })

  it('recusa outro status', () => {
    expect(healthSchema.safeParse({ status: 'down' }).success).toBe(false)
  })
})
