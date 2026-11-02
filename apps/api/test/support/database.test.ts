import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDatabase, type TestDatabase } from './database'

let a: TestDatabase
let b: TestDatabase

beforeAll(async () => {
  ;[a, b] = await Promise.all([createTestDatabase(), createTestDatabase()])
})
afterAll(async () => {
  await Promise.all([a.drop(), b.drop()])
})

describe('createTestDatabase', () => {
  it('entrega bancos independentes: o que um arquivo grava, o outro não vê', async () => {
    await a.db.execute(sql`CREATE TABLE scratch (id int)`)
    await a.db.execute(sql`INSERT INTO scratch VALUES (1)`)

    const inB = await b.db.execute(sql`SELECT to_regclass('public.scratch') AS found`)

    expect(inB[0]?.found).toBeNull()
  })
})
