import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { describe, expect, it } from 'vitest'
import { EnvError, loadEnv } from '../env'
import { loadDatabaseTarget, loadSeedPasswords } from './env'

const LOCAL_URL = 'postgres://axis:axis@localhost:5432/axis'
const NEON_URL = 'postgres://axis:segredo@ep-exemplo.us-east-1.aws.neon.tech/axis?sslmode=require'

const passwords = {
  SEED_PASSWORD_SELLER: 'senha-do-vendedor',
  SEED_PASSWORD_COORDINATOR: 'senha-do-coordenador',
  SEED_PASSWORD_DIRECTOR: 'senha-do-diretor',
  SEED_PASSWORD_ADMINISTRATOR: 'senha-do-administrador',
}

const localTarget = loadDatabaseTarget({ DATABASE_URL_UNPOOLED: LOCAL_URL })
const productionTarget = loadDatabaseTarget({ DATABASE_URL_UNPOOLED: NEON_URL })

describe('loadDatabaseTarget', () => {
  it('banco local em dev não é production', () => {
    expect(localTarget).toEqual({ url: LOCAL_URL, host: 'localhost', production: false })
  })

  it('NODE_ENV=production é production, mesmo em banco local', () => {
    const target = loadDatabaseTarget({ NODE_ENV: 'production', DATABASE_URL_UNPOOLED: LOCAL_URL })
    expect(target.production).toBe(true)
  })

  it('banco fora da máquina é production, mesmo com o NODE_ENV de dev do .env', () => {
    const target = loadDatabaseTarget({ NODE_ENV: 'development', DATABASE_URL_UNPOOLED: NEON_URL })
    expect(target).toMatchObject({ host: 'ep-exemplo.us-east-1.aws.neon.tech', production: true })
  })

  it('exige a URL direta do banco', () => {
    expect(() => loadDatabaseTarget({ DATABASE_URL: LOCAL_URL })).toThrow(/DATABASE_URL_UNPOOLED/)
  })
})

describe('loadSeedPasswords', () => {
  it('lê uma senha por perfil', () => {
    expect(loadSeedPasswords(passwords, localTarget)).toEqual({
      seller: 'senha-do-vendedor',
      coordinator: 'senha-do-coordenador',
      director: 'senha-do-diretor',
      administrator: 'senha-do-administrador',
    })
  })

  it('sem senha nenhuma, diz todas as que faltam, sem valor padrão', () => {
    expect(() => loadSeedPasswords({}, localTarget)).toThrow(EnvError)
    for (const name of Object.keys(passwords)) {
      expect(() => loadSeedPasswords({}, localTarget)).toThrow(new RegExp(name))
    }
  })

  it('recusa senha curta demais e senha que o login não aceitaria', () => {
    expect(() =>
      loadSeedPasswords({ ...passwords, SEED_PASSWORD_SELLER: 'curta' }, localTarget),
    ).toThrow(/SEED_PASSWORD_SELLER/)
    expect(() =>
      loadSeedPasswords({ ...passwords, SEED_PASSWORD_DIRECTOR: 'x'.repeat(129) }, localTarget),
    ).toThrow(/SEED_PASSWORD_DIRECTOR/)
  })

  it('aceita em production uma senha que não é a de dev', () => {
    expect(loadSeedPasswords(passwords, productionTarget).seller).toBe('senha-do-vendedor')
  })

  describe('com os valores do .env.example', () => {
    const example = parseEnv(readFileSync(new URL('../../.env.example', import.meta.url), 'utf8'))

    it('servem em dev, sem pedir segredo a ninguém', () => {
      expect(() => loadSeedPasswords(example, localTarget)).not.toThrow()
    })

    it('são recusados em production: estão públicos no repositório', () => {
      expect(() => loadSeedPasswords(example, productionTarget)).toThrow(EnvError)
      expect(() => loadSeedPasswords(example, productionTarget)).toThrow(/SEED_PASSWORD_SELLER/)
    })
  })
})

describe('a API não depende das variáveis do seed', () => {
  it('sobe sem as senhas, que só o comando de seed valida', () => {
    expect(() =>
      loadEnv({
        DATABASE_URL: LOCAL_URL,
        DATABASE_URL_UNPOOLED: LOCAL_URL,
        JWT_SECRET: 'segredo-de-teste-com-pelo-menos-32-caracteres',
      }),
    ).not.toThrow()
  })
})
