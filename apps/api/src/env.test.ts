import { describe, expect, it } from 'vitest'
import { EnvError, loadEnv } from './env'

const valid = {
  DATABASE_URL: 'postgres://axis:axis@localhost:5432/axis',
  DATABASE_URL_UNPOOLED: 'postgres://axis:axis@localhost:5432/axis',
}

describe('loadEnv', () => {
  it('lê as variáveis válidas e aplica os padrões', () => {
    expect(loadEnv(valid)).toEqual({
      nodeEnv: 'development',
      port: 3000,
      databaseUrl: valid.DATABASE_URL,
      databaseUrlUnpooled: valid.DATABASE_URL_UNPOOLED,
    })
  })

  it('converte a PORT para número', () => {
    expect(loadEnv({ ...valid, PORT: '8080' }).port).toBe(8080)
  })

  it('recusa iniciar sem a URL do banco e diz qual variável falta', () => {
    const { DATABASE_URL: _, ...semUrl } = valid
    expect(() => loadEnv(semUrl)).toThrow(EnvError)
    expect(() => loadEnv(semUrl)).toThrow(/DATABASE_URL\b/)
  })

  it('exige a URL direta do banco, usada pelas migrations', () => {
    const { DATABASE_URL_UNPOOLED: _, ...semDireta } = valid
    expect(() => loadEnv(semDireta)).toThrow(/DATABASE_URL_UNPOOLED/)
  })

  it('recusa valor inválido e diz qual variável está errada', () => {
    expect(() => loadEnv({ ...valid, PORT: 'abc' })).toThrow(/PORT/)
    expect(() => loadEnv({ ...valid, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/)
    expect(() => loadEnv({ ...valid, DATABASE_URL: 'mysql://x/y' })).toThrow(/DATABASE_URL\b/)
  })

  it('lista todas as variáveis com problema de uma vez', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL\b[\s\S]*DATABASE_URL_UNPOOLED/)
  })
})
