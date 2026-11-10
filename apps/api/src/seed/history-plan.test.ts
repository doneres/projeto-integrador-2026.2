import { visitStatusOf } from '@axis/contracts'
import { describe, expect, it } from 'vitest'
import { distanceInMeters } from '../geo/distance'
import { SEEDED_CUSTOMERS } from './demo-data'
import { type HistoricCustomer, historicVisits, historyDates } from './history-plan'

describe('historyDates', () => {
  it('do dia 1º do mês anterior até ontem, só de segunda a sexta', () => {
    // 2026-11-10 é terça.
    const dates = historyDates('2026-11-10')
    expect(dates[0]).toBe('2026-10-01')
    expect(dates.at(-1)).toBe('2026-11-09')
    expect(dates).not.toContain('2026-11-10')
    for (const date of dates) {
      const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()
      expect(weekday, date).not.toBe(0)
      expect(weekday, date).not.toBe(6)
    }
    // Outubro de 2026 tem 22 dias úteis; novembro, até o dia 9, tem 6 (2 a 6 e 9).
    expect(dates).toHaveLength(28)
  })

  it('no dia 1º, só o mês anterior inteiro; em janeiro, o anterior é dezembro', () => {
    const dates = historyDates('2027-01-01')
    expect(dates[0]).toBe('2026-12-01')
    expect(dates.at(-1)).toBe('2026-12-31')
  })
})

const RADIUS = 100
const customers: HistoricCustomer[] = SEEDED_CUSTOMERS.filter(
  (c) => c.team === 'A' && c.origin === 'portfolio' && c.status === 'active',
).map((c, index) => ({ id: `cliente-${index}`, latitude: c.latitude, longitude: c.longitude }))
const byId = new Map(customers.map((c) => [c.id, c]))

const sellers = ['2001', '2002', '2003', '2004', '2005', '2006']
const sample = sellers.flatMap((registration) =>
  historyDates('2026-11-10').flatMap((date) =>
    historicVisits({ registration, date, customers, radiusMeters: RADIUS }),
  ),
)

/** Dentro de 3 pontos percentuais do alvo: a semente é fixa, então o desvio não oscila. */
const expectShare = (actual: number, target: number) =>
  expect(Math.abs(actual - target), `${actual} vs ${target}`).toBeLessThanOrEqual(0.03)

const share = (predicate: (v: (typeof sample)[number]) => boolean) =>
  sample.filter(predicate).length / sample.length

describe('historicVisits', () => {
  it('é sempre o mesmo para o mesmo Vendedor e a mesma data', () => {
    const args = { registration: '2002', date: '2026-10-15', customers, radiusMeters: RADIUS }
    expect(historicVisits(args)).toEqual(historicVisits(args))
    expect(historicVisits({ ...args, date: '2026-10-16' })).not.toEqual(historicVisits(args))
  })

  it('Clientes distintos, posições 1..n e horários do dia, em ordem', () => {
    const visits = historicVisits({
      registration: '2001',
      date: '2026-10-15',
      customers,
      radiusMeters: RADIUS,
    })
    expect(new Set(visits.map((v) => v.customerId)).size).toBe(visits.length)
    expect(visits.map((v) => v.position)).toEqual(visits.map((_, i) => i + 1))
    for (const [index, visit] of visits.entries()) {
      expect(visit.checkedOutAt.getTime()).toBeGreaterThan(visit.checkedInAt.getTime())
      const next = visits[index + 1]
      if (next) expect(next.checkedInAt.getTime()).toBeGreaterThan(visit.checkedOutAt.getTime())
      // Entre 8h e 18h em São Paulo.
      expect(visit.checkedInAt.toISOString() >= '2026-10-15T11:00:00.000Z').toBe(true)
      expect(visit.checkedOutAt.toISOString() <= '2026-10-15T21:00:00.000Z').toBe(true)
    }
  })

  it('Desfechos perto de 55 / 25 / 10 / 10 %, com justificativa nos que não realizam', () => {
    expect(sample.length).toBeGreaterThan(500)
    expectShare(
      share((v) => v.outcome === 'sale_made'),
      0.55,
    )
    expectShare(
      share((v) => v.outcome === 'audit_only'),
      0.25,
    )
    expectShare(
      share((v) => v.outcome === 'customer_closed'),
      0.1,
    )
    expectShare(
      share((v) => v.outcome === 'not_performed'),
      0.1,
    )
    for (const visit of sample) {
      const performed =
        visitStatusOf({
          checkedInAt: visit.checkedInAt.toISOString(),
          checkedOutAt: visit.checkedOutAt.toISOString(),
          outcome: visit.outcome,
        }) === 'completed'
      expect(Boolean(visit.outcomeJustification)).toBe(!performed)
    }
  })

  it('cerca de 8 % Fora do Raio, com justificativa; a distância gravada é a real', () => {
    expectShare(
      share((v) => v.checkInStatus === 'out_of_radius'),
      0.08,
    )
    for (const visit of sample) {
      const customer = byId.get(visit.customerId) as HistoricCustomer
      const distance = distanceInMeters(
        { latitude: visit.checkInLatitude, longitude: visit.checkInLongitude },
        customer,
      )
      expect(visit.checkInDistanceMeters).toBeCloseTo(distance, 6)
      if (visit.checkInStatus === 'on_site') {
        expect(distance).toBeLessThanOrEqual(RADIUS)
        expect(visit.checkInAccuracyMeters).toBeLessThanOrEqual(50)
        expect(visit.checkInJustification).toBeNull()
      } else {
        expect(distance).toBeGreaterThan(RADIUS)
        expect(visit.checkInJustification).toBeTruthy()
      }
    }
  })

  it('respeita o raio configurado', () => {
    const visits = historyDates('2026-11-10').flatMap((date) =>
      historicVisits({ registration: '2003', date, customers, radiusMeters: 30 }),
    )
    for (const visit of visits) {
      expect(visit.checkInStatus === 'on_site').toBe(visit.checkInDistanceMeters <= 30)
    }
  })
})
