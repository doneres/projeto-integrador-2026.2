import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { describe, expect, it } from 'vitest'
import { EnvError, loadEnv } from '../env'
import { loadDatabaseTarget, loadDemoLocation, loadSeedPasswords } from './env'

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

describe('loadDemoLocation', () => {
  it('sem as variáveis, não há coordenada a sobrescrever', () => {
    expect(loadDemoLocation({})).toBeUndefined()
  })

  it('variáveis vazias contam como ausentes, e não como latitude zero', () => {
    expect(loadDemoLocation({ SEED_DEMO_LATITUDE: '', SEED_DEMO_LONGITUDE: ' ' })).toBeUndefined()
  })

  it('lê a latitude e a longitude', () => {
    expect(
      loadDemoLocation({ SEED_DEMO_LATITUDE: '-16.68', SEED_DEMO_LONGITUDE: '-49.25' }),
    ).toEqual({ latitude: -16.68, longitude: -49.25 })
  })

  it('aceita a coordenada zero', () => {
    expect(loadDemoLocation({ SEED_DEMO_LATITUDE: '0', SEED_DEMO_LONGITUDE: '0' })).toEqual({
      latitude: 0,
      longitude: 0,
    })
  })

  it('recusa só uma das duas, dizendo qual falta', () => {
    expect(() => loadDemoLocation({ SEED_DEMO_LATITUDE: '-16.68' })).toThrow(EnvError)
    expect(() => loadDemoLocation({ SEED_DEMO_LATITUDE: '-16.68' })).toThrow(/SEED_DEMO_LONGITUDE/)
    expect(() => loadDemoLocation({ SEED_DEMO_LONGITUDE: '-49.25' })).toThrow(/SEED_DEMO_LATITUDE/)
  })

  it.each([
    ['fora da faixa', '91', '-49.25', /SEED_DEMO_LATITUDE/],
    ['fora da faixa', '-16.68', '181', /SEED_DEMO_LONGITUDE/],
    ['com vírgula decimal', '-16,68', '-49.25', /SEED_DEMO_LATITUDE/],
  ])('recusa coordenada %s', (_, latitude, longitude, message) => {
    expect(() =>
      loadDemoLocation({ SEED_DEMO_LATITUDE: latitude, SEED_DEMO_LONGITUDE: longitude }),
    ).toThrow(message)
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
