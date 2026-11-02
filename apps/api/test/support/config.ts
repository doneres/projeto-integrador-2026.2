/**
 * Postgres dos testes de integração: o do Docker Compose em dev (`pnpm db:up`) e o service do
 * GitHub Actions no CI. A URL só aponta o servidor; cada arquivo de teste ganha o seu banco.
 */
export const TEST_SERVER_URL =
  process.env.DATABASE_URL ?? 'postgres://axis:axis@localhost:5432/axis'

/** Banco modelo: recebe as migrations uma vez e é copiado para cada arquivo de teste. */
export const TEMPLATE_DATABASE = 'axis_test_template'

/** Prefixo dos bancos criados pelos testes; global-setup apaga os que sobraram de execuções que caíram. */
export const TEST_DATABASE_PREFIX = 'axis_test_'

/** Mesma URL do servidor, apontando para outro banco. */
export function urlForDatabase(serverUrl: string, database: string): string {
  const url = new URL(serverUrl)
  url.pathname = `/${database}`
  return url.toString()
}
