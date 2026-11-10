import {
  pageOf,
  type RouteDetail,
  type RouteVisit,
  routeDetailSchema,
  routeSchema,
} from '@axis/contracts'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Harness, harness, withHarness } from '../../test/support/demo-harness'
import { distanceInMeters } from '../geo/distance'
import { calendarDateInSaoPaulo } from '../time/calendar-date'

// Terça-feira, 12h em Brasília: o histórico vai de 1º de outubro a segunda, 9 de novembro.
const TUESDAY = new Date('2026-11-10T15:00:00Z')
const TODAY = '2026-11-10'
const DIRECTOR = '3001'
const SELLERS = ['2001', '2002', '2003', '2004', '2005', '2006']
const RADIUS = 100
/** Semear e ler ~200 rotas pela API leva alguns segundos com a suíte inteira em paralelo. */
const SLOW = 60_000

/** Dentro de 3 pontos percentuais do alvo: a semente é fixa, então o desvio não oscila. */
const expectShare = (actual: number, target: number) =>
  expect(Math.abs(actual - target), `${actual} vs ${target}`).toBeLessThanOrEqual(0.03)

const routePage = pageOf(routeSchema)

/** Todas as rotas, com as Visitas, como o Diretor as vê pela API. */
async function allRoutes(h: Harness): Promise<RouteDetail[]> {
  const { token } = await h.sessionOf(DIRECTOR)
  const get = async (url: string) => {
    const response = await h.app.inject({
      method: 'GET',
      url,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(response.statusCode, url).toBe(200)
    return response.json()
  }

  const summaries = []
  for (let page = 1; ; page++) {
    const { items, total } = routePage.parse(await get(`/v1/routes?perPage=100&page=${page}`))
    summaries.push(...items)
    if (summaries.length >= total || items.length === 0) break
  }
  return Promise.all(
    summaries.map(async (route) => routeDetailSchema.parse(await get(`/v1/routes/${route.id}`))),
  )
}

const historyOf = (routes: RouteDetail[]) => routes.filter((route) => route.date < TODAY)

describe('histórico do seed demo', () => {
  let h: Harness
  let history: RouteDetail[]
  let visits: RouteVisit[]
  let sellerIdOf: Map<string, string>

  beforeAll(async () => {
    h = await harness(TUESDAY)
    await h.seed(TUESDAY)
    history = historyOf(await allRoutes(h))
    visits = history.flatMap((route) => route.visits)
    sellerIdOf = new Map(
      await Promise.all(
        SELLERS.map(async (r) => [r, (await h.sessionOf(r)).user.id] as [string, string]),
      ),
    )
  }, SLOW)
  afterAll(() => h.finish())

  it('mês anterior inteiro e o corrente até ontem, só em dias úteis, para todos os Vendedores', () => {
    const dates = [...new Set(history.map((route) => route.date))].sort()
    expect(dates[0]).toBe('2026-10-01')
    expect(dates.at(-1)).toBe('2026-11-09')
    // 22 dias úteis em outubro e 6 em novembro até o dia 9.
    expect(dates).toHaveLength(28)
    for (const date of dates) {
      expect([0, 6], date).not.toContain(new Date(`${date}T12:00:00Z`).getUTCDay())
    }
    for (const [registration, sellerId] of sellerIdOf) {
      const own = history.filter((route) => route.sellerId === sellerId).map((r) => r.date)
      expect(own.sort(), registration).toEqual(dates)
    }
  })

  it('existem os quatro Desfechos, perto de 55 / 25 / 10 / 10 %', () => {
    const share = (outcome: string) =>
      visits.filter((visit) => visit.outcome === outcome).length / visits.length
    expectShare(share('sale_made'), 0.55)
    expectShare(share('audit_only'), 0.25)
    expectShare(share('customer_closed'), 0.1)
    expectShare(share('not_performed'), 0.1)
  })

  it('há Flags de auditoria: cerca de 8 % Fora do Raio, todas com justificativa', () => {
    const flagged = visits.filter((visit) => visit.checkInStatus === 'out_of_radius')
    expect(flagged.length).toBeGreaterThan(0)
    expectShare(flagged.length / visits.length, 0.08)
    for (const visit of flagged) {
      expect(visit.checkInJustification).toBeTruthy()
      expect(visit.checkInDistanceMeters ?? 0).toBeGreaterThan(RADIUS)
    }
  })

  it('No Local: dentro do raio, precisão de até 50 m e distância medida até o Cliente', () => {
    for (const visit of visits) {
      const reading = {
        latitude: visit.checkInLatitude ?? Number.NaN,
        longitude: visit.checkInLongitude ?? Number.NaN,
      }
      expect(visit.checkInDistanceMeters).toBeCloseTo(distanceInMeters(reading, visit.customer), 3)
      if (visit.checkInStatus !== 'on_site') continue
      expect(visit.checkInDistanceMeters ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(RADIUS)
      expect(visit.checkInAccuracyMeters ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(50)
      expect(visit.checkInJustification).toBeNull()
    }
  })

  it('estados derivados consistentes: só Concluídas e Não realizadas, com a justificativa certa', () => {
    for (const visit of visits) {
      const performed = visit.outcome === 'sale_made' || visit.outcome === 'audit_only'
      expect(visit.status).toBe(performed ? 'completed' : 'not_performed')
      expect(Boolean(visit.outcomeJustification)).toBe(!performed)
      expect(
        visit.checkedInAt && visit.checkedOutAt && visit.checkedOutAt > visit.checkedInAt,
      ).toBe(true)
      expect(calendarDateInSaoPaulo(new Date(visit.checkedInAt ?? ''))).toBe(
        history.find((route) => route.id === visit.routeId)?.date,
      )
    }
  })

  it('só Clientes ativos de carteira, e nunca o de demonstração', () => {
    for (const visit of visits) {
      expect(visit.customer.status).toBe('active')
      expect(visit.customer.origin).toBe('portfolio')
      expect(visit.customer.tradeName).not.toContain('Demonstração')
    }
  })

  it(
    'rodar de novo no mesmo dia não muda a contagem',
    async () => {
      const report = await h.seed(TUESDAY)
      expect(report.historyRoutesCreated).toBe(0)
      expect(report.historyVisitsCreated).toBe(0)
      const again = historyOf(await allRoutes(h))
      expect(again.length).toBe(history.length)
      expect(again.flatMap((route) => route.visits).length).toBe(visits.length)
    },
    SLOW,
  )

  it(
    'num dia posterior acrescenta só as datas novas, sem duplicar nem mexer nas antigas',
    async () => {
      await withHarness(TUESDAY, async (other) => {
        const before = historyOf(await allRoutes(other))

        // Sexta: a terça e a quarta já têm rota (a de hoje e a de amanhã); a quinta é nova.
        const friday = new Date('2026-11-13T15:00:00Z')
        other.state.clock = friday
        const report = await other.seed(friday)
        expect(report.historyRoutesCreated).toBe(SELLERS.length)

        const after = (await allRoutes(other)).filter((route) => route.date < '2026-11-13')
        const keys = after.map((route) => `${route.sellerId} ${route.date}`)
        expect(new Set(keys).size).toBe(keys.length)
        expect(after.filter((route) => route.date === '2026-11-12')).toHaveLength(SELLERS.length)
        // As rotas antigas são as mesmas, com as mesmas Visitas.
        const byId = new Map(after.map((route) => [route.id, route]))
        for (const route of before) {
          expect(byId.get(route.id)?.visits.map((v) => [v.id, v.outcome])).toEqual(
            route.visits.map((v) => [v.id, v.outcome]),
          )
        }
      })
    },
    SLOW,
  )
})
