import { loginSchema } from '@axis/contracts'

// Os campos ainda são os do contrato em português; acompanham a migração do ADR 0001.
describe('contrato da API (@axis/contracts)', () => {
  it('os schemas são importáveis e validam dados no app', () => {
    expect(loginSchema.safeParse({ identificador: '2001', senha: 'axis-demo-2026' }).success).toBe(
      true,
    )
    expect(loginSchema.safeParse({ identificador: '', senha: 'curta' }).success).toBe(false)
  })
})
