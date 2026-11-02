import { describe, expect, it } from 'vitest'
import {
  checkInBodySchema,
  checkOutBodySchema,
  type Visit,
  visitSchema,
  visitStatusOf,
} from './visit'

const visit: Visit = {
  id: '0192f4a0-0000-7000-8000-0000000000c1',
  routeId: '0192f4a0-0000-7000-8000-0000000000d1',
  customerId: '0192f4a0-0000-7000-8000-0000000000e1',
  position: 1,
  checkedInAt: null,
  checkInLatitude: null,
  checkInLongitude: null,
  checkInAccuracyMeters: null,
  checkInDistanceMeters: null,
  checkInStatus: null,
  checkInJustification: null,
  checkedOutAt: null,
  outcome: null,
  outcomeJustification: null,
  summary: null,
  createdAt: '2026-11-02T12:00:00Z',
  updatedAt: '2026-11-02T12:00:00Z',
}

const checkedIn: Visit = {
  ...visit,
  checkedInAt: '2026-11-03T13:00:00Z',
  checkInLatitude: -16.6869,
  checkInLongitude: -49.2648,
  checkInAccuracyMeters: 12,
  checkInDistanceMeters: 30,
  checkInStatus: 'on_site',
}

describe('visitSchema', () => {
  it('aceita a visita recém-criada com a rota, ainda sem check-in', () => {
    expect(visitSchema.safeParse(visit).success).toBe(true)
  })

  it('aceita um check-in no local', () => {
    expect(visitSchema.safeParse(checkedIn).success).toBe(true)
  })

  it('exige justificativa no check-in fora do raio', () => {
    const outOfRadius = { ...checkedIn, checkInStatus: 'out_of_radius', checkInDistanceMeters: 480 }

    const withoutReason = visitSchema.safeParse(outOfRadius)
    expect(withoutReason.success).toBe(false)
    expect(withoutReason.error?.issues[0]?.path).toEqual(['checkInJustification'])
    expect(
      visitSchema.safeParse({ ...outOfRadius, checkInJustification: 'Rua bloqueada' }).success,
    ).toBe(true)
  })

  it('o check-in grava a leitura completa do GPS', () => {
    expect(visitSchema.safeParse({ ...checkedIn, checkInDistanceMeters: null }).success).toBe(false)
  })

  it('o check-out e o desfecho vêm juntos', () => {
    const checkedOutWithoutOutcome = { ...checkedIn, checkedOutAt: '2026-11-03T14:00:00Z' }
    const outcomeWithoutCheckOut = { ...checkedIn, outcome: 'sale_made' }

    expect(visitSchema.safeParse(checkedOutWithoutOutcome).success).toBe(false)
    expect(visitSchema.safeParse(outcomeWithoutCheckOut).success).toBe(false)
  })

  it('recusa check-out sem check-in', () => {
    const result = visitSchema.safeParse({
      ...visit,
      checkedOutAt: '2026-11-03T14:00:00Z',
      outcome: 'sale_made',
    })

    expect(result.success).toBe(false)
  })

  it.each(['customer_closed', 'not_performed'])('exige justificativa do desfecho %s', (outcome) => {
    const closed = { ...checkedIn, checkedOutAt: '2026-11-03T14:00:00Z', outcome }

    expect(visitSchema.safeParse(closed).success).toBe(false)
    expect(visitSchema.safeParse({ ...closed, outcomeJustification: 'Loja fechada' }).success).toBe(
      true,
    )
  })

  it.each(['sale_made', 'audit_only'])('o desfecho %s dispensa justificativa', (outcome) => {
    const done = { ...checkedIn, checkedOutAt: '2026-11-03T14:00:00Z', outcome }

    expect(visitSchema.safeParse(done).success).toBe(true)
  })

  it('recusa desfecho e situação do check-in fora do modelo', () => {
    expect(visitSchema.safeParse({ ...checkedIn, checkInStatus: 'no_local' }).success).toBe(false)
    expect(visitSchema.safeParse({ ...checkedIn, outcome: 'venda' }).success).toBe(false)
  })
})

describe('visitStatusOf', () => {
  const finished = { ...checkedIn, checkedOutAt: '2026-11-03T14:00:00Z' }

  it('é a mesma derivação do modelo de dados', () => {
    expect(visitStatusOf(visit)).toBe('pending')
    expect(visitStatusOf(checkedIn)).toBe('in_progress')
    expect(visitStatusOf({ ...finished, outcome: 'sale_made' })).toBe('completed')
    expect(visitStatusOf({ ...finished, outcome: 'audit_only' })).toBe('completed')
    expect(visitStatusOf({ ...finished, outcome: 'customer_closed' })).toBe('not_performed')
    expect(visitStatusOf({ ...finished, outcome: 'not_performed' })).toBe('not_performed')
  })
})

describe('checkInBodySchema', () => {
  const body = {
    latitude: -16.6869,
    longitude: -49.2648,
    accuracyMeters: 12,
    occurredAt: '2026-11-03T13:00:00Z',
  }

  it('aceita a leitura do GPS com o instante do aparelho', () => {
    expect(checkInBodySchema.safeParse(body).success).toBe(true)
    expect(checkInBodySchema.safeParse({ ...body, justification: 'Rua bloqueada' }).success).toBe(
      true,
    )
  })

  it('exige a localização e o instante', () => {
    const { latitude: _, ...withoutLatitude } = body
    expect(checkInBodySchema.safeParse(withoutLatitude).success).toBe(false)
    const { occurredAt: _o, ...withoutInstant } = body
    expect(checkInBodySchema.safeParse(withoutInstant).success).toBe(false)
  })
})

describe('checkOutBodySchema', () => {
  const body = { outcome: 'sale_made', occurredAt: '2026-11-03T14:00:00Z' }

  it('aceita desfecho de venda sem justificativa', () => {
    expect(checkOutBodySchema.safeParse(body).success).toBe(true)
  })

  it.each(['customer_closed', 'not_performed'])('exige justificativa em %s', (outcome) => {
    const result = checkOutBodySchema.safeParse({ ...body, outcome })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['outcomeJustification'])
    expect(
      checkOutBodySchema.safeParse({ ...body, outcome, outcomeJustification: 'Loja fechada' })
        .success,
    ).toBe(true)
  })

  it('não aceita justificativa só com espaços', () => {
    const result = checkOutBodySchema.safeParse({
      ...body,
      outcome: 'not_performed',
      outcomeJustification: '   ',
    })

    expect(result.success).toBe(false)
  })
})
