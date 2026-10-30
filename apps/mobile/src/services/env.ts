import { z } from 'zod'

const envSchema = z.object({
  EXPO_PUBLIC_API_URL: z.url({
    protocol: /^https?$/,
    message: 'EXPO_PUBLIC_API_URL deve ser uma URL completa (http://...)',
  }),
})

export type Env = { apiUrl: string }

/** Valida o ambiente. Só a URL da API entra no app; todo EXPO_PUBLIC_* é embutido no bundle. */
export function readEnv(source: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(source)
  if (!parsed.success) {
    const detail = parsed.error.issues[0]?.message
    throw new Error(
      `Ambiente inválido: ${detail ?? 'EXPO_PUBLIC_API_URL ausente'} (veja .env.example)`,
    )
  }
  return { apiUrl: parsed.data.EXPO_PUBLIC_API_URL.replace(/\/+$/, '') }
}

let cached: Env | undefined

/** Ambiente do app. O Expo só substitui `process.env.EXPO_PUBLIC_*` em acesso estático. */
export function getEnv(): Env {
  cached ??= readEnv({ EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL })
  return cached
}
