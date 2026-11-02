import postgres from 'postgres'
import { runMigrations } from '../../src/db/migrate'
import { MIGRATIONS_FOLDER } from '../../src/paths'
import { TEMPLATE_DATABASE, TEST_DATABASE_PREFIX, TEST_SERVER_URL, urlForDatabase } from './config'

/** Roda uma vez antes dos testes: migra o banco modelo que cada arquivo de teste vai copiar. */
export default async function setup() {
  const admin = postgres(TEST_SERVER_URL, { max: 1, onnotice: () => {} })
  try {
    const stale = await admin<{ datname: string }[]>`
      SELECT datname FROM pg_database WHERE datname LIKE ${`${TEST_DATABASE_PREFIX}%`}`
    for (const { datname } of stale) {
      await admin.unsafe(`DROP DATABASE IF EXISTS "${datname}" WITH (FORCE)`)
    }
    await admin.unsafe(`CREATE DATABASE "${TEMPLATE_DATABASE}"`)
  } catch (error) {
    throw new Error(
      `Não consegui usar o Postgres dos testes em ${new URL(TEST_SERVER_URL).host}. ` +
        'Suba o banco com "pnpm db:up" ou defina DATABASE_URL.',
      { cause: error },
    )
  } finally {
    await admin.end()
  }
  await runMigrations(urlForDatabase(TEST_SERVER_URL, TEMPLATE_DATABASE), MIGRATIONS_FOLDER)
}
