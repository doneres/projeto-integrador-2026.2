import { describe, expect, it } from 'vitest'
import { syncSnapshotSchema } from './sync'

const id = (n: number) => `0192f4a0-0000-7000-8000-${String(n).padStart(12, '0')}`
const STAMP = '2026-11-03T12:00:00Z'

const prospect = {
  id: id(1),
  legalName: 'Mercearia Modelo Ltda',
  tradeName: 'Mercearia Modelo',
  document: '11222333000181',
  phone: '62999990000',
  contactName: 'Maria',
  zipCode: '74000000',
  street: 'Rua Exemplo',
  number: '100',
  complement: null,
  district: 'Setor Central',
  city: 'Goiânia',
  state: 'GO',
  latitude: -16.68,
  longitude: -49.26,
  origin: 'prospect',
  status: 'pending_approval',
  coordinatorId: id(2),
  createdById: id(3),
  approvedById: null,
  approvedAt: null,
  rejectionReason: null,
  createdAt: STAMP,
  updatedAt: STAMP,
}

const snapshot = {
  generatedAt: STAMP,
  checkinRadiusMeters: 100,
  routes: [],
  prospects: [prospect],
}

describe('syncSnapshotSchema', () => {
  it('aceita o snapshot com o raio, as rotas e as Prospecções do Vendedor', () => {
    expect(syncSnapshotSchema.safeParse(snapshot).success).toBe(true)
  })

  it('a Prospecção Rejeitada carrega o motivo', () => {
    const rejected = { ...prospect, status: 'rejected', rejectionReason: 'Endereço inexistente' }
    expect(syncSnapshotSchema.safeParse({ ...snapshot, prospects: [rejected] }).success).toBe(true)
  })

  it('a Prospecção Rejeitada sem motivo é recusada', () => {
    const rejected = { ...prospect, status: 'rejected' }
    expect(syncSnapshotSchema.safeParse({ ...snapshot, prospects: [rejected] }).success).toBe(false)
  })

  it('só Prospecções entram na lista: um Cliente de carteira é recusado', () => {
    const portfolio = { ...prospect, origin: 'portfolio', status: 'active' }
    expect(syncSnapshotSchema.safeParse({ ...snapshot, prospects: [portfolio] }).success).toBe(
      false,
    )
  })

  it('o raio é positivo', () => {
    expect(syncSnapshotSchema.safeParse({ ...snapshot, checkinRadiusMeters: 0 }).success).toBe(
      false,
    )
  })
})
