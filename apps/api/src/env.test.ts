import { describe, expect, it } from 'vitest'
import { EnvError, loadEnv } from './env'

const valid = {
  DATABASE_URL: 'postgres://axis:axis@localhost:5432/axis',
  DATABASE_URL_UNPOOLED: 'postgres://axis:axis@localhost:5432/axis',
  JWT_SECRET: 'segredo-de-teste-com-pelo-menos-32-caracteres',
}

describe('loadEnv', () => {
  it('lê as variáveis válidas e aplica os padrões', () => {
    expect(loadEnv(valid)).toEqual({
      nodeEnv: 'development',
      port: 3000,
      databaseUrl: valid.DATABASE_URL,
      databaseUrlUnpooled: valid.DATABASE_URL_UNPOOLED,
      jwtSecret: valid.JWT_SECRET,
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

  it('recusa iniciar sem o segredo do JWT ou com um segredo curto', () => {
    const { JWT_SECRET: _, ...semSegredo } = valid
    expect(() => loadEnv(semSegredo)).toThrow(/JWT_SECRET: variável ausente/)
    expect(() => loadEnv({ ...valid, JWT_SECRET: 'curto' })).toThrow(/JWT_SECRET/)
  })

  it('em produção recusa o segredo de desenvolvimento do .env.example', () => {
    const devSecret = 'desenvolvimento-local-troque-em-producao-0123456789'

    expect(() => loadEnv({ ...valid, NODE_ENV: 'production', JWT_SECRET: devSecret })).toThrow(
      /JWT_SECRET/,
    )
    expect(loadEnv({ ...valid, NODE_ENV: 'development', JWT_SECRET: devSecret }).jwtSecret).toBe(
      devSecret,
    )
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
