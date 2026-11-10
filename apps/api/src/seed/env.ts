import { latitudeSchema, loginBodySchema, longitudeSchema } from '@axis/contracts'
import { z } from 'zod'
import { EnvError, envSchema, parseEnv } from '../env'
import type { Coordinates } from '../geo/distance'
import type { SeedPasswords } from './base'

/** Banco em que o seed e o reset vão mexer. */
export type DatabaseTarget = {
  /** A URL direta, sem pooler. */
  url: string
  host: string
  /** Pede cuidado: nas senhas do seed e na confirmação do reset. */
  production: boolean
}

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]']

/** Valor do .env.example: serve em dev, mas é público, então não pode virar senha em production. */
const DEV_PASSWORD = 'axis-demo-2026'

const targetSchema = envSchema.pick({ NODE_ENV: true, DATABASE_URL_UNPOOLED: true })

// Parte do schema do login, para o seed não criar uma senha que o login não aceitaria.
const password = loginBodySchema.shape.password.min(8, 'deve ter pelo menos 8 caracteres')

const passwordsSchema = z.object({
  SEED_PASSWORD_SELLER: password,
  SEED_PASSWORD_COORDINATOR: password,
  SEED_PASSWORD_DIRECTOR: password,
  SEED_PASSWORD_ADMINISTRATOR: password,
})

// Vazia conta como ausente: Number('') seria 0, uma coordenada válida no meio do oceano.
const coordinate = (range: z.ZodNumber) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.coerce.number().pipe(range).optional(),
  )

const demoLocationSchema = z.object({
  SEED_DEMO_LATITUDE: coordinate(latitudeSchema),
  SEED_DEMO_LONGITUDE: coordinate(longitudeSchema),
})

/**
 * Banco fora da máquina conta como production mesmo sem NODE_ENV=production: quem aponta a URL
 * para o Neon com o .env de dev na máquina não pode zerar o banco real sem a cerimônia.
 */
export function loadDatabaseTarget(source: Record<string, string | undefined>): DatabaseTarget {
  const env = parseEnv(targetSchema, source)
  const { hostname } = new URL(env.DATABASE_URL_UNPOOLED)
  return {
    url: env.DATABASE_URL_UNPOOLED,
    host: hostname,
    production: env.NODE_ENV === 'production' || !LOCAL_HOSTS.includes(hostname),
  }
}

/** Coordenada que sobrescreve a do Cliente de demonstração: as duas variáveis, ou nenhuma. */
export function loadDemoLocation(
  source: Record<string, string | undefined>,
): Coordinates | undefined {
  const { SEED_DEMO_LATITUDE: latitude, SEED_DEMO_LONGITUDE: longitude } = parseEnv(
    demoLocationSchema,
    source,
  )
  if (latitude === undefined && longitude === undefined) return undefined
  if (latitude === undefined) throw new EnvError(['SEED_DEMO_LATITUDE: variável ausente'])
  if (longitude === undefined) throw new EnvError(['SEED_DEMO_LONGITUDE: variável ausente'])
  return { latitude, longitude }
}

/** Só o comando de seed chama isto: a API sobe sem essas variáveis. */
export function loadSeedPasswords(
  source: Record<string, string | undefined>,
  target: DatabaseTarget,
): SeedPasswords {
  const env = parseEnv(passwordsSchema, source)
  if (target.production) {
    const known = Object.entries(env).filter(([, value]) => value === DEV_PASSWORD)
    if (known.length > 0) {
      throw new EnvError(
        known.map(([name]) => `${name}: é a senha de desenvolvimento do .env.example; use outra`),
      )
    }
  }
  return {
    seller: env.SEED_PASSWORD_SELLER,
    coordinator: env.SEED_PASSWORD_COORDINATOR,
    director: env.SEED_PASSWORD_DIRECTOR,
    administrator: env.SEED_PASSWORD_ADMINISTRATOR,
  }
}
