import { type CheckInStatus, type Outcome, visitStatusOf } from '@axis/contracts'
import { type Coordinates, distanceInMeters } from '../geo/distance'
import { addCalendarDays, startOfDayInSaoPaulo } from '../time/calendar-date'
import { randomFrom, SEED } from './demo-data'

// O histórico da camada demo, sem banco nem relógio: as Visitas de um Vendedor num dia dependem
// só da matrícula e da data, então rodar o seed em outro dia gera as mesmas Visitas para as datas
// que já existiam e só acrescenta as novas.

const STOPS_PER_DAY = 5
const FIRST_CHECK_IN_HOUR = 8
const MINUTES_BETWEEN_STOPS = 90
const MINUTE_MS = 60 * 1000

const OUT_OF_RADIUS_SHARE = 0.08
/** Fora do Raio: de 50 m a 800 m além do raio. */
const OUT_OF_RADIUS_EXTRA_METERS = [50, 800] as const
/** No Local: até 80 % do raio, para a distância não encostar no limite. */
const ON_SITE_RADIUS_SHARE = 0.8
const ACCURACY_METERS = [5, 50] as const
const METERS_PER_DEGREE_OF_LATITUDE = 111_320

/** Distribuição dos Desfechos pedida pela #66, acumulada. */
const OUTCOME_THRESHOLDS: readonly [Outcome, number][] = [
  ['sale_made', 0.55],
  ['audit_only', 0.8],
  ['customer_closed', 0.9],
  ['not_performed', 1],
]

const SUMMARY: Record<Outcome, string | null> = {
  sale_made: 'Pedido de reposição registrado.',
  audit_only: 'Gôndola conferida, sem necessidade de pedido.',
  customer_closed: null,
  not_performed: null,
}
const OUTCOME_JUSTIFICATIONS: Partial<Record<Outcome, readonly string[]>> = {
  customer_closed: [
    'Estabelecimento fechado no horário da visita.',
    'Portas fechadas; vizinho informou feriado do bairro.',
  ],
  not_performed: [
    'Responsável ausente; visita reagendada.',
    'Rota interrompida por problema no veículo.',
  ],
}
const CHECK_IN_JUSTIFICATIONS = [
  'GPS impreciso dentro do galpão.',
  'Atendimento no depósito do Cliente, em outra quadra.',
  'Entrada pela rua de trás do estabelecimento.',
]

export type HistoricCustomer = Coordinates & { id: string }

export type HistoricVisit = {
  customerId: string
  position: number
  checkedInAt: Date
  checkInLatitude: number
  checkInLongitude: number
  checkInAccuracyMeters: number
  checkInDistanceMeters: number
  checkInStatus: CheckInStatus
  checkInJustification: string | null
  checkedOutAt: Date
  outcome: Outcome
  outcomeJustification: string | null
  summary: string | null
}

const isWeekday = (date: string) => {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()
  return weekday !== 0 && weekday !== 6
}

/** Os dias úteis (segunda a sexta) do dia 1º do mês anterior até ontem. */
export function historyDates(today: string): string[] {
  const [year, month] = today.split('-').map(Number) as [number, number]
  const previous = month === 1 ? [year - 1, 12] : [year, month - 1]
  let date = `${previous[0]}-${String(previous[1]).padStart(2, '0')}-01`
  const dates: string[] = []
  while (date < today) {
    if (isWeekday(date)) dates.push(date)
    date = addCalendarDays(date, 1)
  }
  return dates
}

const between = (random: () => number, [min, max]: readonly [number, number]) =>
  min + random() * (max - min)

const pick = <T>(random: () => number, items: readonly T[]) =>
  items[Math.floor(random() * items.length)] as T

/** Um ponto a `meters` metros de `origin`, numa direção sorteada. */
function pointAround(random: () => number, origin: Coordinates, meters: number): Coordinates {
  const bearing = random() * 2 * Math.PI
  const latitudeDelta = (meters * Math.cos(bearing)) / METERS_PER_DEGREE_OF_LATITUDE
  const longitudeDelta =
    (meters * Math.sin(bearing)) /
    (METERS_PER_DEGREE_OF_LATITUDE * Math.cos((origin.latitude * Math.PI) / 180))
  return { latitude: origin.latitude + latitudeDelta, longitude: origin.longitude + longitudeDelta }
}

export type HistoricRouteInput = {
  registration: string
  date: string
  /** Os Clientes que podem entrar na rota, sempre na mesma ordem (pelo documento). */
  customers: readonly HistoricCustomer[]
  /** O raio do Check-in em vigor (Parâmetros do sistema). */
  radiusMeters: number
}

/**
 * As Visitas executadas de uma rota passada: todas com Check-in e Check-out. A distância é medida
 * de verdade, com o mesmo helper da API, e a situação sai dela; a justificativa do Desfecho vem
 * quando o estado derivado (`visitStatusOf`) diz que a Visita não foi realizada.
 */
export function historicVisits({
  registration,
  date,
  customers,
  radiusMeters,
}: HistoricRouteInput): HistoricVisit[] {
  const random = randomFrom(
    SEED + Number(registration) * 100_003 + Number(date.replaceAll('-', '')),
  )

  // Fisher-Yates parcial: os primeiros STOPS_PER_DAY de um embaralhamento.
  const pool = [...customers]
  const stops = Math.min(STOPS_PER_DAY, pool.length)
  for (let i = 0; i < stops; i++) {
    const j = i + Math.floor(random() * (pool.length - i))
    ;[pool[i], pool[j]] = [pool[j] as HistoricCustomer, pool[i] as HistoricCustomer]
  }

  const dayStart = startOfDayInSaoPaulo(date).getTime() + FIRST_CHECK_IN_HOUR * 60 * MINUTE_MS

  return pool.slice(0, stops).map((customer, index) => {
    const checkedInAt = new Date(
      dayStart + (index * MINUTES_BETWEEN_STOPS + Math.floor(random() * 20)) * MINUTE_MS,
    )
    const checkedOutAt = new Date(
      checkedInAt.getTime() + (15 + Math.floor(random() * 45)) * MINUTE_MS,
    )

    const outOfRadius = random() < OUT_OF_RADIUS_SHARE
    const offset = outOfRadius
      ? radiusMeters + between(random, OUT_OF_RADIUS_EXTRA_METERS)
      : random() * radiusMeters * ON_SITE_RADIUS_SHARE
    const position = pointAround(random, customer, offset)
    const distance = distanceInMeters(position, customer)
    const checkInStatus: CheckInStatus = distance <= radiusMeters ? 'on_site' : 'out_of_radius'

    const draw = random()
    const outcome = (OUTCOME_THRESHOLDS.find(([, upTo]) => draw < upTo) ?? ['sale_made'])[0]
    const status = visitStatusOf({
      checkedInAt: checkedInAt.toISOString(),
      checkedOutAt: checkedOutAt.toISOString(),
      outcome,
    })

    return {
      customerId: customer.id,
      position: index + 1,
      checkedInAt,
      checkInLatitude: position.latitude,
      checkInLongitude: position.longitude,
      checkInAccuracyMeters: Math.round(between(random, ACCURACY_METERS)),
      checkInDistanceMeters: distance,
      checkInStatus,
      checkInJustification:
        checkInStatus === 'out_of_radius' ? pick(random, CHECK_IN_JUSTIFICATIONS) : null,
      checkedOutAt,
      outcome,
      outcomeJustification:
        status === 'not_performed' ? pick(random, OUTCOME_JUSTIFICATIONS[outcome] ?? []) : null,
      summary: SUMMARY[outcome],
    }
  })
}
