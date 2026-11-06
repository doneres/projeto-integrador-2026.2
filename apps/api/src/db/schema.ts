// Tabelas do banco (Drizzle). Os nomes seguem docs/05-modelo-dados/README.md: tabelas em
// snake_case no banco, camelCase no código. As demais entram junto com as telas que as usam.
import {
  type CheckInStatus,
  type CustomerOrigin,
  type CustomerStatus,
  checkInStatusSchema,
  customerOriginSchema,
  customerStatusSchema,
  type Outcome,
  outcomeSchema,
  type Role,
  roleSchema,
} from '@axis/contracts'
import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  doublePrecision,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

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
    // Obrigatório e só permitido para vendedor. Que ele aponte para um coordenador é garantido
    // por trigger (drizzle/0002_coordinator_rule.sql), que um CHECK não consegue expressar.
    check(
      'user_coordinator_only_for_seller',
      sql`(${table.role} = 'seller') = (${table.coordinatorId} IS NOT NULL)`,
    ),
    check('user_email_lowercase', sql`${table.email} = lower(${table.email})`),
  ],
)

/** Parâmetros do sistema: linha única, criada pelo seed. Só o Administrador altera. */
export const systemSettings = pgTable(
  'system_settings',
  {
    /** Sempre 1: a chave primária é o que garante a linha única. */
    id: integer().primaryKey().default(1),
    checkinRadiusMeters: integer().notNull(),
    scoreWeightRevenue: integer().notNull(),
    scoreWeightVisits: integer().notNull(),
    scoreWeightNewCustomers: integer().notNull(),
    /** Nulo enquanto valerem os padrões do seed. */
    updatedById: uuid().references(() => users.id),
    ...timestamps,
  },
  (table) => [
    check('system_settings_single_row', sql`${table.id} = 1`),
    check('system_settings_radius_positive', sql`${table.checkinRadiusMeters} > 0`),
    check(
      'system_settings_weights_not_negative',
      sql`${table.scoreWeightRevenue} >= 0 AND ${table.scoreWeightVisits} >= 0 AND ${table.scoreWeightNewCustomers} >= 0`,
    ),
    check(
      'system_settings_weights_sum_100',
      sql`${table.scoreWeightRevenue} + ${table.scoreWeightVisits} + ${table.scoreWeightNewCustomers} = 100`,
    ),
  ],
)

/**
 * Estabelecimento atendido por uma Equipe. Nunca é excluído, só inativado. A prospecção
 * (`origin = 'prospect'`) usa a mesma tabela; o fluxo de aprovação vem em outro ticket.
 */
export const customers = pgTable(
  'customer',
  {
    id: uuid().primaryKey(),
    legalName: text().notNull(),
    tradeName: text().notNull(),
    /** CPF ou CNPJ sem máscara. */
    document: text().notNull(),
    phone: text().notNull(),
    contactName: text().notNull(),
    zipCode: text().notNull(),
    street: text().notNull(),
    number: text().notNull(),
    complement: text(),
    district: text().notNull(),
    city: text().notNull(),
    state: text().notNull(),
    /** Obrigatórias: o check-in compara a posição do vendedor com elas (RN01). */
    latitude: doublePrecision().notNull(),
    longitude: doublePrecision().notNull(),
    /** Imutável. */
    origin: text({
      enum: customerOriginSchema.options as [CustomerOrigin, ...CustomerOrigin[]],
    }).notNull(),
    status: text({
      enum: customerStatusSchema.options as [CustomerStatus, ...CustomerStatus[]],
    }).notNull(),
    /** Dono do cliente (a Equipe): o coordenador. */
    coordinatorId: uuid()
      .notNull()
      .references(() => users.id),
    createdById: uuid()
      .notNull()
      .references(() => users.id),
    approvedById: uuid().references(() => users.id),
    /** Define o mês do "novo cliente". */
    approvedAt: timestamp({ withTimezone: true }),
    rejectionReason: text(),
    ...timestamps,
  },
  (table) => [
    // O mesmo CPF/CNPJ pode voltar depois de uma prospecção rejeitada.
    uniqueIndex('customer_document_unique')
      .on(table.document)
      .where(sql`${table.status} <> 'rejected'`),
    index('customer_coordinator_idx').on(table.coordinatorId),
    check('customer_latitude_range', sql`${table.latitude} BETWEEN -90 AND 90`),
    check('customer_longitude_range', sql`${table.longitude} BETWEEN -180 AND 180`),
    check(
      'customer_rejection_reason_only_when_rejected',
      sql`(${table.status} = 'rejected') = (${table.rejectionReason} IS NOT NULL)`,
    ),
    check(
      'customer_approval_together',
      sql`(${table.approvedById} IS NULL) = (${table.approvedAt} IS NULL)`,
    ),
    // Cliente de carteira nasce ativo, sem passar pela aprovação.
    check(
      'customer_portfolio_never_pending',
      sql`${table.origin} = 'prospect' OR ${table.status} NOT IN ('pending_approval', 'rejected')`,
    ),
  ],
)

/** As Visitas de um Vendedor em um dia, montadas pelo Coordenador. */
export const routes = pgTable(
  'route',
  {
    id: uuid().primaryKey(),
    sellerId: uuid()
      .notNull()
      .references(() => users.id),
    /** Data de calendário no fuso America/Sao_Paulo ("2026-11-03"). */
    date: date({ mode: 'string' }).notNull(),
    createdById: uuid()
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (table) => [unique('route_seller_date_unique').on(table.sellerId, table.date)],
)

/**
 * A linha nasce com a rota; check-in e check-out só preenchem colunas dela. O estado (Pendente,
 * Em andamento, Concluída, Não realizada) não é coluna: sai de `visitStatusOf`, de @axis/contracts.
 */
export const visits = pgTable(
  'visit',
  {
    id: uuid().primaryKey(),
    routeId: uuid()
      .notNull()
      .references(() => routes.id, { onDelete: 'cascade' }),
    customerId: uuid()
      .notNull()
      .references(() => customers.id),
    /** Ordem manual definida pelo Coordenador, a partir de 1. */
    position: integer().notNull(),
    checkedInAt: timestamp({ withTimezone: true }),
    checkInLatitude: doublePrecision(),
    checkInLongitude: doublePrecision(),
    checkInAccuracyMeters: doublePrecision(),
    checkInDistanceMeters: doublePrecision(),
    /** Gravado, e não recalculado: o raio do check-in é um parâmetro e muda. */
    checkInStatus: text({
      enum: checkInStatusSchema.options as [CheckInStatus, ...CheckInStatus[]],
    }),
    checkInJustification: text(),
    checkedOutAt: timestamp({ withTimezone: true }),
    outcome: text({ enum: outcomeSchema.options as [Outcome, ...Outcome[]] }),
    outcomeJustification: text(),
    summary: text(),
    ...timestamps,
  },
  (table) => [
    unique('visit_route_customer_unique').on(table.routeId, table.customerId),
    index('visit_route_position_idx').on(table.routeId, table.position),
    index('visit_customer_idx').on(table.customerId),
    check('visit_position_positive', sql`${table.position} >= 1`),
    // O check-in grava a leitura do GPS, a distância e a situação de uma vez; sem check-in, nada disso.
    check(
      'visit_check_in_complete',
      sql`num_nonnulls(${table.checkedInAt}, ${table.checkInLatitude}, ${table.checkInLongitude}, ${table.checkInAccuracyMeters}, ${table.checkInDistanceMeters}, ${table.checkInStatus}) IN (0, 6)`,
    ),
    check(
      'visit_out_of_radius_justified',
      sql`${table.checkInStatus} IS DISTINCT FROM 'out_of_radius' OR ${table.checkInJustification} IS NOT NULL`,
    ),
    check(
      'visit_check_out_needs_check_in',
      sql`${table.checkedOutAt} IS NULL OR ${table.checkedInAt} IS NOT NULL`,
    ),
    check(
      'visit_check_out_with_outcome',
      sql`(${table.checkedOutAt} IS NULL) = (${table.outcome} IS NULL)`,
    ),
    check(
      'visit_outcome_justified',
      sql`${table.outcome} IS NULL OR ${table.outcome} IN ('sale_made', 'audit_only') OR ${table.outcomeJustification} IS NOT NULL`,
    ),
  ],
)
