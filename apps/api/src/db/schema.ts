// Tabelas do banco (Drizzle). Os nomes seguem docs/05-modelo-dados/README.md: tabelas em
// snake_case no banco, camelCase no código. As demais entram junto com as telas que as usam.
import { type Role, roleSchema } from '@axis/contracts'
import { sql } from 'drizzle-orm'
import { boolean, check, foreignKey, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}

/** Vendedor, Coordenador, Diretor e Administrador. Nunca é excluído, só desativado. */
export const users = pgTable(
  'user',
  {
    id: uuid().primaryKey(),
    name: text().notNull(),
    /** Sempre em minúsculas: o login compara em minúsculas. */
    email: text().notNull().unique(),
    /** Matrícula; o login aceita e-mail ou matrícula. */
    registration: text().notNull().unique(),
    passwordHash: text().notNull(),
    role: text({ enum: roleSchema.options as [Role, ...Role[]] }).notNull(),
    coordinatorId: uuid(),
    /** Conta inativa perde o acesso na hora (conferido a cada requisição). */
    active: boolean().notNull().default(true),
    ...timestamps,
  },
  (table) => [
    foreignKey({ columns: [table.coordinatorId], foreignColumns: [table.id] }),
    // Obrigatório e só permitido para vendedor. Que ele aponte para um coordenador é conferido
    // em createUser, a única porta de entrada de usuários.
    check(
      'user_coordinator_only_for_seller',
      sql`(${table.role} = 'seller') = (${table.coordinatorId} IS NOT NULL)`,
    ),
    check('user_email_lowercase', sql`${table.email} = lower(${table.email})`),
  ],
)
