import { z } from 'zod'

const postgresUrl = z.url({ protocol: /^postgres(ql)?$/, message: 'deve ser uma URL postgres://' })

/** Prefixo do JWT_SECRET do .env.example: serve em dev, mas em produção deixaria os tokens forjáveis. */
const DEV_SECRET_PREFIX = 'desenvolvimento-local'

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: postgresUrl,
  DATABASE_URL_UNPOOLED: postgresUrl,
  JWT_SECRET: z.string().min(32, 'deve ter pelo menos 32 caracteres'),
})

export type Env = {
  nodeEnv: 'development' | 'test' | 'production'
  port: number
  /** Conexão das requisições (no Neon, a URL com pooler). */
  databaseUrl: string
  /** Conexão direta, sem pooler: é a que roda as migrations. */
  databaseUrlUnpooled: string
  /** Segredo que assina os JWT de sessão. */
  jwtSecret: string
}

/** Lançado quando o ambiente está incompleto ou inválido; a mensagem lista cada variável. */
export class EnvError extends Error {
  constructor(problems: string[]) {
    super(`Ambiente inválido (veja .env.example):\n${problems.map((p) => `  - ${p}`).join('\n')}`)
    this.name = 'EnvError'
  }
}

/** Valida o ambiente e recusa iniciar se faltar variável ou se alguma estiver inválida. */
export function loadEnv(source: Record<string, string | undefined>): Env {
  const env = parseEnv(envSchema, source)
  if (env.NODE_ENV === 'production' && env.JWT_SECRET.startsWith(DEV_SECRET_PREFIX)) {
    throw new EnvError(['JWT_SECRET: é o segredo de desenvolvimento do .env.example; gere um novo'])
  }
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
    databaseUrlUnpooled: env.DATABASE_URL_UNPOOLED,
    jwtSecret: env.JWT_SECRET,
  }
}

/** Valida com o schema dado; em erro, lança um `EnvError` que lista cada variável. */
export function parseEnv<Schema extends z.ZodType>(
  schema: Schema,
  source: Record<string, string | undefined>,
): z.output<Schema> {
  const parsed = schema.safeParse(source)
  if (!parsed.success) {
    throw new EnvError(
      parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${messageFor(issue, source)}`),
    )
  }
  return parsed.data
}

function messageFor(issue: z.core.$ZodIssue, source: Record<string, string | undefined>): string {
  const name = String(issue.path[0])
  return source[name] === undefined ? 'variável ausente' : issue.message
}
