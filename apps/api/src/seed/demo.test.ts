import { type Customer, type Route, syncSnapshotSchema } from '@axis/contracts'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Harness, harness, passwords, withHarness } from '../../test/support/demo-harness'
import { customers, routes, users, visits } from '../db/schema'
import { distanceInMeters } from '../geo/distance'
import { calendarDateInSaoPaulo } from '../time/calendar-date'
import { DEFAULT_DEMO_LOCATION } from './demo-data'

// Sábado, 12h em Brasília: a rota de hoje e a de amanhã (domingo) têm de existir mesmo assim.
const SATURDAY = new Date('2026-11-07T15:00:00Z')
const TODAY = '2026-11-07'
const TOMORROW = '2026-11-08'

const COORDINATOR_A = '1001'
const COORDINATOR_B = '1002'
const SHOWCASE = '2001'
const TEST_SELLERS_A = ['2002', '2003']
const TEST_SELLERS_B = ['2004', '2005', '2006']
const TEST_SELLERS = [...TEST_SELLERS_A, ...TEST_SELLERS_B]

const isDemoCustomer = (customer: { tradeName: string }) =>
  customer.tradeName.includes('Demonstração')

describe('seedDemo', () => {
  let h: Harness

  beforeAll(async () => {
    h = await harness(SATURDAY)
    await h.seed(SATURDAY)
  })
  afterAll(() => h.finish())

  describe('pessoas', () => {
    it('Equipe A da Maria Souza e Equipe B, com 3 Vendedores cada', async () => {
      const coordinatorA = (await h.sessionOf(COORDINATOR_A)).user
      const coordinatorB = (await h.sessionOf(COORDINATOR_B)).user
      expect(coordinatorA.name).toBe('Maria Souza')
      expect(coordinatorB.role).toBe('coordinator')

      for (const registration of [SHOWCASE, ...TEST_SELLERS_A]) {
        expect((await h.sessionOf(registration)).user.coordinatorId).toBe(coordinatorA.id)
      }
      for (const registration of TEST_SELLERS_B) {
        expect((await h.sessionOf(registration)).user.coordinatorId).toBe(coordinatorB.id)
      }
      expect((await h.sessionOf(SHOWCASE)).user.name).toBe('Bruno Exemplo')
    })

    it('tem um Diretor e um Administrador, e o Vendedor desativado não entra', async () => {
      expect((await h.sessionOf('3001')).user.role).toBe('director')
      expect((await h.sessionOf('4001')).user.role).toBe('administrator')

      const [disabled, ...others] = await h.db.select().from(users).where(eq(users.active, false))
      expect(others).toEqual([])
      expect(disabled?.role).toBe('seller')
      expect((await h.login(disabled?.registration ?? '', passwords.seller)).statusCode).toBe(401)
    })
  })

  describe('Clientes', () => {
    it('cerca de 24 de carteira ativos e 2 Inativos, nas duas Equipes', async () => {
      const all = await h.customersOf('3001')
      const portfolio = all.filter((customer) => customer.origin === 'portfolio')

      expect(portfolio.filter((customer) => customer.status === 'active')).toHaveLength(24)
      expect(portfolio.filter((customer) => customer.status === 'inactive')).toHaveLength(2)
      expect(portfolio.every((customer) => customer.city === 'Goiânia')).toBe(true)
    })

    it('Prospecções: 3 Pendentes na A, 1 na B, 2 aprovadas no mês e 1 Rejeitada com motivo', async () => {
      const prospects = async (registration: string) =>
        (await h.customersOf(registration)).filter((customer) => customer.origin === 'prospect')
      const pending = (list: Customer[]) =>
        list.filter((customer) => customer.status === 'pending_approval')

      expect(pending(await prospects(COORDINATOR_A))).toHaveLength(3)
      expect(pending(await prospects(COORDINATOR_B))).toHaveLength(1)

      const all = await prospects('3001')
      const approved = all.filter((customer) => customer.status === 'active')
      expect(approved).toHaveLength(2)
      for (const customer of approved) {
        expect(customer.approvedById).not.toBeNull()
        expect(calendarDateInSaoPaulo(new Date(customer.approvedAt ?? 0)).slice(0, 7)).toBe(
          '2026-11',
        )
      }

      const rejected = all.filter((customer) => customer.status === 'rejected')
      expect(rejected).toHaveLength(1)
      expect(rejected[0]?.rejectionReason).toBeTruthy()
    })

    it('a Prospecção foi cadastrada por um Vendedor da Equipe e ele a enxerga', async () => {
      const coordinatorA = (await h.sessionOf(COORDINATOR_A)).user
      const pendingA = (await h.customersOf(COORDINATOR_A)).filter(
        (customer) => customer.status === 'pending_approval',
      )
      const showcase = (await h.sessionOf(SHOWCASE)).user

      expect(pendingA.every((customer) => customer.coordinatorId === coordinatorA.id)).toBe(true)
      const own = pendingA.find((customer) => customer.createdById === showcase.id)
      expect(own).toBeDefined()
      expect((await h.customersOf(SHOWCASE)).map((customer) => customer.id)).toContain(own?.id)
    })

    it('um Cliente de demonstração por Equipe, na coordenada padrão em Goiânia', async () => {
      for (const registration of [COORDINATOR_A, COORDINATOR_B]) {
        const demo = (await h.customersOf(registration)).filter(isDemoCustomer)
        expect(demo).toHaveLength(1)
        expect(demo[0]).toMatchObject({
          ...DEFAULT_DEMO_LOCATION,
          origin: 'portfolio',
          status: 'active',
        })
      }
    })
  })

  describe('escopo por perfil', () => {
    it('Coordenador A só vê a A, B só a B, e o Diretor vê as duas', async () => {
      const a = await h.customersOf(COORDINATOR_A)
      const b = await h.customersOf(COORDINATOR_B)
      const director = await h.customersOf('3001')
      const idsA = new Set(a.map((customer) => customer.id))

      expect(a.length).toBeGreaterThan(0)
      expect(b.length).toBeGreaterThan(0)
      expect(b.some((customer) => idsA.has(customer.id))).toBe(false)
      expect(director).toHaveLength(a.length + b.length)

      const teamOf = async (registrations: string[]) =>
        Promise.all(registrations.map(async (r) => (await h.sessionOf(r)).user.id))
      const sellersOf = (list: Route[]) => list.map((route) => route.sellerId).sort()

      for (const date of [TODAY, TOMORROW]) {
        expect(sellersOf(await h.routesOf(COORDINATOR_A, date))).toEqual(
          (await teamOf([SHOWCASE, ...TEST_SELLERS_A])).sort(),
        )
        expect(sellersOf(await h.routesOf(COORDINATOR_B, date))).toEqual(
          (await teamOf(TEST_SELLERS_B)).sort(),
        )
        expect(await h.routesOf('3001', date)).toHaveLength(6)
      }
    })

    it('toda rota só tem Clientes ativos de carteira da Equipe do Vendedor', async () => {
      for (const registration of [SHOWCASE, ...TEST_SELLERS]) {
        const { coordinatorId } = (await h.sessionOf(registration)).user
        for (const date of [TODAY, TOMORROW]) {
          const route = await h.routeOn(registration, date)
          for (const { customer } of route.visits) {
            expect(customer.coordinatorId).toBe(coordinatorId)
            expect(customer.status).toBe('active')
            expect(customer.origin).toBe('portfolio')
          }
        }
      }
    })
  })

  describe('rotas', () => {
    it('rota de teste 100 % Pendente hoje e amanhã, mesmo no fim de semana', async () => {
      for (const registration of TEST_SELLERS) {
        for (const date of [TODAY, TOMORROW]) {
          const route = await h.routeOn(registration, date)
          expect(route.date).toBe(date)
          expect(route.visits.length).toBeGreaterThanOrEqual(2)
          expect(new Set(route.visits.map((visit) => visit.status))).toEqual(new Set(['pending']))
        }
      }
    })

    it('rota de teste começa pelo Cliente de demonstração e segue a distâncias variadas', async () => {
      for (const registration of TEST_SELLERS) {
        for (const date of [TODAY, TOMORROW]) {
          const [first, ...others] = (await h.routeOn(registration, date)).visits
          expect(first?.position).toBe(1)
          expect(isDemoCustomer(first?.customer ?? { tradeName: '' })).toBe(true)

          const distances = others.map(({ customer }) =>
            distanceInMeters(DEFAULT_DEMO_LOCATION, customer),
          )
          expect(new Set(distances.map(Math.round)).size).toBe(others.length)
          // Todas Fora do Raio para quem está no Cliente de demonstração, de perto até bem longe.
          expect(Math.min(...distances)).toBeGreaterThan(100)
          expect(Math.max(...distances) - Math.min(...distances)).toBeGreaterThan(2000)
        }
      }
    })

    it('showcase hoje: Concluídas, uma Em andamento e o resto Pendente', async () => {
      const route = await h.routeOn(SHOWCASE, TODAY)
      expect(route.visits.map((visit) => visit.status)).toEqual([
        'completed',
        'completed',
        'in_progress',
        'pending',
        'pending',
        'pending',
      ])
      expect(new Set((await h.routeOn(SHOWCASE, TOMORROW)).visits.map((v) => v.status))).toEqual(
        new Set(['pending']),
      )
    })

    it('o Check-in do showcase é coerente com a coordenada do Cliente', async () => {
      const route = await h.routeOn(SHOWCASE, TODAY)
      const executed = route.visits.filter((visit) => visit.checkedInAt)
      expect(executed).toHaveLength(3)

      for (const visit of executed) {
        const measured = distanceInMeters(
          { latitude: visit.checkInLatitude ?? 0, longitude: visit.checkInLongitude ?? 0 },
          visit.customer,
        )
        expect(visit.checkInDistanceMeters).toBeCloseTo(measured, 3)
        expect(measured).toBeLessThanOrEqual(100)
        expect(visit.checkInStatus).toBe('on_site')
        expect(visit.checkInAccuracyMeters).toBeLessThanOrEqual(50)
      }
    })
  })

  describe('snapshot do Vendedor (contrato com o seed)', () => {
    const snapshotOf = async (registration: string) => {
      const response = await h.get(registration, '/v1/sync/snapshot')
      expect(response.statusCode, `snapshot de ${registration}`).toBe(200)
      return syncSnapshotSchema.parse(response.json())
    }

    it('cada Vendedor de teste recebe a rota de hoje e a de amanhã, com os Clientes, e o raio', async () => {
      for (const registration of [SHOWCASE, ...TEST_SELLERS]) {
        const snapshot = await snapshotOf(registration)
        expect(snapshot.routes.map((route) => route.date)).toEqual([TODAY, TOMORROW])
        expect(snapshot.checkinRadiusMeters).toBe(100)
        for (const [index, date] of [TODAY, TOMORROW].entries()) {
          const expected = await h.routeOn(registration, date)
          expect(snapshot.routes[index]).toEqual(expected)
        }
      }
    })

    it('não traz Cliente nem Prospecção de outra Equipe nem de outro Vendedor', async () => {
      for (const registration of [SHOWCASE, ...TEST_SELLERS]) {
        const { user } = await h.sessionOf(registration)
        const snapshot = await snapshotOf(registration)
        for (const route of snapshot.routes) {
          expect(route.sellerId).toBe(user.id)
          for (const { customer } of route.visits) {
            expect(customer.coordinatorId).toBe(user.coordinatorId)
          }
        }
        for (const prospect of snapshot.prospects) {
          expect(prospect.createdById).toBe(user.id)
          expect(prospect.origin).toBe('prospect')
        }
      }
    })

    it('as Prospecções vêm com o estado e, se Rejeitada, o motivo', async () => {
      const showcase = await snapshotOf(SHOWCASE)
      expect(showcase.prospects.map((p) => p.status).sort()).toEqual(['active', 'pending_approval'])

      const ana = await snapshotOf('2002')
      expect(ana.prospects.map((p) => [p.status, p.rejectionReason]).sort()).toEqual([
        ['pending_approval', null],
        ['rejected', 'Fora da área atendida pela Equipe'],
      ])
    })
  })

  describe('datas relativas ao dia da execução', () => {
    it('usa o dia de São Paulo, não o de UTC', async () => {
      // 22h30 de 07/11 em Brasília; em UTC já é dia 08.
      const lateEvening = new Date('2026-11-08T01:30:00Z')
      await withHarness(lateEvening, async (other) => {
        // As anteriores são o histórico, que tem teste próprio (history.test.ts).
        const dates = (await other.db.select().from(routes))
          .map((route) => route.date)
          .filter((date) => date >= '2026-11-07')
        expect(new Set(dates)).toEqual(new Set(['2026-11-07', '2026-11-08']))
      })
    })

    it('atravessa a virada de mês, com a aprovação no mês da execução', async () => {
      const lastDayOfMonth = new Date('2026-11-30T15:00:00Z')
      await withHarness(lastDayOfMonth, async (other) => {
        const dates = (await other.db.select().from(routes))
          .map((route) => route.date)
          .filter((date) => date >= '2026-11-30')
        expect(new Set(dates)).toEqual(new Set(['2026-11-30', '2026-12-01']))

        const approved = (await other.customersOf('3001')).filter((c) => c.approvedAt)
        expect(approved).toHaveLength(2)
        for (const customer of approved) {
          expect(calendarDateInSaoPaulo(new Date(customer.approvedAt ?? 0)).slice(0, 7)).toBe(
            '2026-11',
          )
        }
      })
    })

    it('logo depois da meia-noite, tudo do showcase fica no dia e antes de agora', async () => {
      const justAfterMidnight = new Date('2026-12-01T03:00:30Z') // 00h00min30s de 01/12 em Brasília
      await withHarness(justAfterMidnight, async (other) => {
        const route = await other.routeOn(SHOWCASE, '2026-12-01')
        const instants = route.visits
          .flatMap((visit) => [visit.checkedInAt, visit.checkedOutAt])
          .filter((value): value is string => value !== null && value !== undefined)
          .map((value) => new Date(value))

        expect(instants).toHaveLength(5)
        for (const instant of instants) {
          expect(calendarDateInSaoPaulo(instant)).toBe('2026-12-01')
          expect(instant.getTime()).toBeLessThanOrEqual(justAfterMidnight.getTime())
        }
        // Check-in, Check-out, próximo Check-in...: os horários seguem a ordem da rota.
        const times = instants.map((instant) => instant.getTime())
        expect(times).toEqual([...times].sort((a, b) => a - b))

        const approved = (await other.customersOf('3001')).filter((c) => c.approvedAt)
        for (const customer of approved) {
          expect(calendarDateInSaoPaulo(new Date(customer.approvedAt ?? 0)).slice(0, 7)).toBe(
            '2026-12',
          )
        }
      })
    })
  })

  describe('semente fixa', () => {
    it('a mesma forma em qualquer execução: Clientes e ordem das rotas iguais', async () => {
      const shape = async (target: Awaited<ReturnType<typeof harness>>, date: string) => {
        const rows = await target.db.select().from(customers)
        const catalog = rows
          .map((row) => `${row.document}|${row.tradeName}|${row.latitude}|${row.longitude}`)
          .sort()
        const routeOrder = (await target.routeOn('2004', date)).visits.map(
          (visit) => visit.customer.document,
        )
        return { catalog, routeOrder }
      }

      const expected = await shape(h, TODAY)
      const otherDay = new Date('2026-12-15T15:00:00Z')
      await withHarness(otherDay, async (other) => {
        expect(await shape(other, '2026-12-15')).toEqual(expected)
      })
    })

    it('o Vendedor não repete a mesma rota hoje e amanhã', async () => {
      const documents = async (date: string) =>
        (await h.routeOn('2004', date)).visits.map((visit) => visit.customer.document)
      expect(await documents(TOMORROW)).not.toEqual(await documents(TODAY))
    })
  })

  describe('massa fictícia', () => {
    it('e-mails em axis.example e nomes Exemplo ou Modelo (fora a Maria do mock)', async () => {
      const people = await h.db.select().from(users)
      for (const person of people) {
        expect(person.email).toMatch(/@axis\.example$/)
        if (person.name !== 'Maria Souza') expect(person.name).toMatch(/Exemplo|Modelo/)
      }
    })

    it('Clientes Exemplo ou Modelo, com documento que nenhum CNPJ numérico tem', async () => {
      // A API valida cada Cliente contra o contrato na resposta, inclusive os dígitos verificadores.
      for (const customer of await h.customersOf('3001')) {
        expect(customer.legalName).toMatch(/Exemplo|Modelo/)
        expect(customer.tradeName).toMatch(/Exemplo|Modelo/)
        expect(customer.document).toMatch(/^[A-Z]/)
      }
    })
  })

  describe('rodando de novo', () => {
    it('no mesmo dia não muda nada, nem a Prospecção Rejeitada, que não tem índice único', async () => {
      await withHarness(SATURDAY, async (other) => {
        const snapshot = async () => ({
          users: await other.db.$count(users),
          customers: await other.db.$count(customers),
          routes: await other.db.$count(routes),
          visits: (await other.db.select().from(visits)).map((v) => [v.id, v.checkedInAt]).sort(),
        })
        const before = await snapshot()

        const report = await other.seed(SATURDAY)

        expect(await snapshot()).toEqual(before)
        expect(report.created).toEqual([])
        expect(report.customersCreated).toBe(0)
        expect(report.routesCreated).toBe(0)
      })
    })

    it('no dia seguinte acrescenta a nova data e o showcase volta a ter estados mistos', async () => {
      const sunday = new Date('2026-11-08T15:00:00Z')
      await withHarness(SATURDAY, async (other) => {
        const customersBefore = await other.db.$count(customers)
        const routeOfTester = await other.routeOn('2005', '2026-11-08')

        other.state.clock = sunday
        const report = await other.seed(sunday)

        expect(report.routesCreated).toBe(6)
        expect(await other.db.$count(customers)).toBe(customersBefore)
        expect(await other.routesOf('3001', '2026-11-09')).toHaveLength(6)
        // A rota que já existia continua a mesma, com as mesmas Visitas.
        expect((await other.routeOn('2005', '2026-11-08')).id).toBe(routeOfTester.id)
        expect((await other.routeOn(SHOWCASE, '2026-11-08')).visits.map((v) => v.status)).toEqual([
          'completed',
          'completed',
          'in_progress',
          'pending',
          'pending',
          'pending',
        ])
        expect(
          new Set((await other.routeOn('2005', '2026-11-08')).visits.map((v) => v.status)),
        ).toEqual(new Set(['pending']))
      })
    })

    it('não refaz a rota do showcase em que alguém já mexeu', async () => {
      await withHarness(SATURDAY, async (other) => {
        const today = await other.routeOn(SHOWCASE, TODAY)
        await other.db
          .update(visits)
          .set({
            checkedInAt: null,
            checkInLatitude: null,
            checkInLongitude: null,
            checkInAccuracyMeters: null,
            checkInDistanceMeters: null,
            checkInStatus: null,
            checkedOutAt: null,
            outcome: null,
          })
          .where(eq(visits.routeId, today.id))
        const pendingVisit = today.visits[5]
        await other.db
          .update(visits)
          .set({
            checkedInAt: SATURDAY,
            checkInLatitude: -16.7,
            checkInLongitude: -49.2,
            checkInAccuracyMeters: 5,
            checkInDistanceMeters: 40,
            checkInStatus: 'on_site',
          })
          .where(eq(visits.id, pendingVisit?.id ?? ''))

        await other.seed(SATURDAY)

        expect((await other.routeOn(SHOWCASE, TODAY)).visits.map((v) => v.status)).toEqual([
          'pending',
          'pending',
          'pending',
          'pending',
          'pending',
          'in_progress',
        ])
      })
    })

    it('Cliente inativado ao vivo continua Inativo e fica fora das rotas novas', async () => {
      await withHarness(SATURDAY, async (other) => {
        const [victim] = (await other.routeOn('2004', TODAY)).visits.slice(1)
        const id = victim?.customer.id ?? ''
        await other.db.update(customers).set({ status: 'inactive' }).where(eq(customers.id, id))

        // Dias depois, para as rotas de hoje e amanhã serem todas novas.
        const later = new Date('2026-11-20T15:00:00Z')
        other.state.clock = later
        await other.seed(later)

        const [row] = await other.db.select().from(customers).where(eq(customers.id, id))
        expect(row?.status).toBe('inactive')
        for (const registration of ['2004', '2005', '2006']) {
          for (const date of ['2026-11-20', '2026-11-21']) {
            const route = await other.routeOn(registration, date)
            expect(route.visits.map((visit) => visit.customer.id)).not.toContain(id)
            expect(route.visits.map((visit) => visit.position)).toEqual(
              route.visits.map((_, index) => index + 1),
            )
          }
        }
      })
    })
  })

  describe('coordenada do Cliente de demonstração', () => {
    const ROOM = { latitude: -16.6412, longitude: -49.3021 }

    it('as variáveis valem na criação, nas duas Equipes', async () => {
      const other = await harness(SATURDAY)
      try {
        await other.seed(SATURDAY, ROOM)
        for (const registration of [COORDINATOR_A, COORDINATOR_B]) {
          const [demo] = (await other.customersOf(registration)).filter(isDemoCustomer)
          expect(demo).toMatchObject(ROOM)
        }
      } finally {
        await other.finish()
      }
    })

    it('as rotas se medem da coordenada nova: longe do raio e do mais perto para o mais longe', async () => {
      // A sala fica exatamente num Cliente da carteira, o pior caso para o Check-in Fora do Raio.
      const neighbor = (await h.customersOf(COORDINATOR_A)).find(
        (c) => c.origin === 'portfolio' && c.status === 'active' && !isDemoCustomer(c),
      )
      const room = { latitude: neighbor?.latitude ?? 0, longitude: neighbor?.longitude ?? 0 }

      const other = await harness(SATURDAY)
      try {
        await other.seed(SATURDAY, room)
        for (const registration of TEST_SELLERS_A) {
          const [first, ...others] = (await other.routeOn(registration, TODAY)).visits
          expect(first?.customer).toMatchObject(room)
          const distances = others.map(({ customer }) => distanceInMeters(room, customer))
          expect(Math.min(...distances)).toBeGreaterThan(100)
          expect(distances).toEqual([...distances].sort((a, b) => a - b))
        }
      } finally {
        await other.finish()
      }
    })

    it('rodar de novo com as variáveis move o Cliente; sem elas, ele fica onde está', async () => {
      await withHarness(SATURDAY, async (other) => {
        await other.seed(SATURDAY, ROOM)
        for (const registration of [COORDINATOR_A, COORDINATOR_B]) {
          const [demo] = (await other.customersOf(registration)).filter(isDemoCustomer)
          expect(demo).toMatchObject(ROOM)
        }

        await other.seed(SATURDAY)
        const [demo] = (await other.customersOf(COORDINATOR_A)).filter(isDemoCustomer)
        expect(demo).toMatchObject(ROOM)
      })
    })
  })
})
