import { loginBodySchema } from '@axis/contracts'

describe('contrato da API (@axis/contracts)', () => {
  it('os schemas são importáveis e validam dados no app', () => {
    expect(
      loginBodySchema.safeParse({ identifier: '2001', password: 'axis-demo-2026' }).success,
    ).toBe(true)
    expect(loginBodySchema.safeParse({ identifier: '', password: '' }).success).toBe(false)
  })
})
