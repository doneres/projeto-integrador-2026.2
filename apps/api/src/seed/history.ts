import { v7 as uuidv7 } from 'uuid'
import type { Database } from '../db/client'
import { type customers, routes, systemSettings, visits } from '../db/schema'
import { calendarDateInSaoPaulo } from '../time/calendar-date'
import { DEMONSTRATION_CUSTOMERS, type SellerKey, type Team } from './demo-data'
import { historicVisits, historyDates } from './history-plan'

type CustomerRow = typeof customers.$inferSelect

export type HistorySeller = SellerKey & { id: string }

export type HistoryOptions = {
  now: Date
  sellers: readonly HistorySeller[]
  coordinatorOf: Record<Team, string>
  /** Os Clientes semeados, como estão no banco agora. */
  customers: readonly CustomerRow[]
}

/** Limite folgado para os parâmetros de um INSERT no Postgres (65 535). */
const VISITS_PER_INSERT = 1000

/**
 * Rotas executadas em todos os dias úteis do mês anterior e do corrente até ontem, para todos os
 * Vendedores ativos. Só cria a rota de um Vendedor numa data que ainda não tem rota: rodar de
 * novo não duplica nada, e rodar num dia posterior só acrescenta as datas novas. Uma data que já
 * tem rota (a de "hoje" de uma execução anterior, por exemplo) fica como está.
 */
export async function seedHistory(
  db: Database,
  { now, sellers, coordinatorOf, customers }: HistoryOptions,
) {
  const [settings] = await db.select().from(systemSettings)
  if (!settings) throw new Error('Parâmetros do sistema ausentes: rode a camada base antes.')

  // Fora o de demonstração, cuja coordenada muda com SEED_DEMO_LATITUDE/LONGITUDE e deixaria
  // incoerente a distância já gravada.
  const demonstration = new Set(DEMONSTRATION_CUSTOMERS.map((c) => c.document))
  const candidatesOf = (team: Team) =>
    customers
      .filter(
        (c) =>
          c.coordinatorId === coordinatorOf[team] &&
          c.origin === 'portfolio' &&
          c.status === 'active' &&
          !demonstration.has(c.document),
      )
      .sort((a, b) => a.document.localeCompare(b.document))

  const dates = historyDates(calendarDateInSaoPaulo(now))
  const plans = sellers.flatMap((seller) => {
    const candidates = candidatesOf(seller.team)
    return dates.map((date) => ({
      route: { id: uuidv7(), sellerId: seller.id, date, createdById: coordinatorOf[seller.team] },
      visits: historicVisits({
        registration: seller.registration,
        date,
        customers: candidates,
        radiusMeters: settings.checkinRadiusMeters,
      }),
    }))
  })
  const withVisits = plans.filter((plan) => plan.visits.length > 0)
  if (withVisits.length === 0) return { routesCreated: 0, visitsCreated: 0 }

  // Numa transação: uma rota sem Visitas contaria como existente e nunca mais seria preenchida.
  return db.transaction(async (tx) => {
    const created = await tx
      .insert(routes)
      .values(withVisits.map((plan) => plan.route))
      .onConflictDoNothing()
      .returning({ id: routes.id })
    const createdIds = new Set(created.map((route) => route.id))

    const rows = withVisits
      .filter((plan) => createdIds.has(plan.route.id))
      .flatMap((plan) =>
        plan.visits.map((visit) => ({ ...visit, id: uuidv7(), routeId: plan.route.id })),
      )
    for (let start = 0; start < rows.length; start += VISITS_PER_INSERT) {
      await tx.insert(visits).values(rows.slice(start, start + VISITS_PER_INSERT))
    }
    return { routesCreated: created.length, visitsCreated: rows.length }
  })
}
