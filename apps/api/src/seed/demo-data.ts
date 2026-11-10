import { type CustomerOrigin, type CustomerStatus, cnpjValido } from '@axis/contracts'
import { type Coordinates, distanceInMeters } from '../geo/distance'

// A massa da camada demo, sem banco nem relógio: depende só da semente, então é igual em toda
// execução e a chave natural (o documento) sempre encontra a linha criada antes.
// Ao acrescentar Clientes, use o fim das listas: mudar a ordem muda os documentos já semeados.

export const SEED = 20261106

/** Gerador mulberry32: pequeno, com semente e sempre com a mesma sequência. */
export function randomFrom(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Team = 'A' | 'B'

export type DemoSeller = {
  team: Team
  name: string
  email: string
  registration: string
}

/** O que a massa precisa saber de um Vendedor para planejar Prospecções e rotas. */
export type SellerKey = Pick<DemoSeller, 'team' | 'registration'>

/** Segundo Coordenador; a Equipe A é a da Maria Souza, da camada base. */
export const COORDINATOR_B = {
  name: 'Carlos Modelo',
  email: 'coordenador.b@axis.example',
  registration: '1002',
}

/** Vendedor showcase, o Bruno Exemplo da camada base. */
export const SHOWCASE_SELLER: SellerKey = { team: 'A', registration: '2001' }

const ANA: DemoSeller = {
  team: 'A',
  name: 'Ana Exemplo',
  email: 'vendedor.a2@axis.example',
  registration: '2002',
}
const CAIO: DemoSeller = {
  team: 'A',
  name: 'Caio Exemplo',
  email: 'vendedor.a3@axis.example',
  registration: '2003',
}
const LIA: DemoSeller = {
  team: 'B',
  name: 'Lia Modelo',
  email: 'vendedor.b1@axis.example',
  registration: '2004',
}
const DAVI: DemoSeller = {
  team: 'B',
  name: 'Davi Modelo',
  email: 'vendedor.b2@axis.example',
  registration: '2005',
}
const RITA: DemoSeller = {
  team: 'B',
  name: 'Rita Modelo',
  email: 'vendedor.b3@axis.example',
  registration: '2006',
}

/** Reservados aos testadores: rotas de hoje e de amanhã sempre 100 % Pendentes. */
export const TEST_SELLERS: DemoSeller[] = [ANA, CAIO, LIA, DAVI, RITA]

export const DISABLED_SELLER: DemoSeller = {
  team: 'A',
  name: 'Otávio Exemplo',
  email: 'vendedor.desativado@axis.example',
  registration: '2099',
}

/** Padrão do Cliente de demonstração; `SEED_DEMO_LATITUDE` e `SEED_DEMO_LONGITUDE` a sobrescrevem. */
export const DEFAULT_DEMO_LOCATION: Coordinates = { latitude: -16.6799, longitude: -49.255 }

// Bairros de Goiânia, com coordenada aproximada. O endereço é sempre a fictícia "Rua Exemplo".
const DISTRICTS: readonly [name: string, latitude: number, longitude: number][] = [
  ['Setor Sul', -16.69, -49.253],
  ['Setor Oeste', -16.683, -49.27],
  ['Setor Universitário', -16.679, -49.24],
  ['Setor Aeroporto', -16.67, -49.268],
  ['Setor Leste Vila Nova', -16.67, -49.24],
  ['Setor Marista', -16.7, -49.263],
  ['Setor Bueno', -16.704, -49.274],
  ['Nova Suíça', -16.71, -49.27],
  ['Setor Coimbra', -16.678, -49.289],
  ['Setor Campinas', -16.668, -49.285],
  ['Jardim Goiás', -16.705, -49.235],
  ['Setor Pedro Ludovico', -16.718, -49.255],
  ['Jardim América', -16.715, -49.283],
  ['Setor Sudoeste', -16.702, -49.295],
  ['Vila Redenção', -16.72, -49.24],
  ['Setor Crimeia Leste', -16.65, -49.265],
  ['Parque Amazônia', -16.734, -49.273],
  ['Setor Negrão de Lima', -16.645, -49.24],
  ['Parque Atheneu', -16.715, -49.215],
  ['Cidade Jardim', -16.69, -49.31],
  ['Jardim Novo Mundo', -16.66, -49.2],
  ['Setor Faiçalville', -16.74, -49.31],
]

const BUSINESSES = [
  'Mercadinho',
  'Padaria',
  'Mercearia',
  'Distribuidora',
  'Empório',
  'Conveniência',
]

export type DemoCustomer = Coordinates & {
  team: Team
  /** Chave natural. */
  document: string
  legalName: string
  tradeName: string
  phone: string
  contactName: string
  zipCode: string
  street: string
  number: string
  district: string
  origin: CustomerOrigin
  status: CustomerStatus
  /** Matrícula do Vendedor que cadastrou a Prospecção; sem ela, foi o Coordenador. */
  createdBy?: string
  approved?: boolean
  rejectionReason?: string
}

/**
 * CNPJ alfanumérico: a raiz começa com letras, então não coincide com nenhum dos CNPJs numéricos
 * já emitidos. Os dígitos verificadores são válidos, pois a API confere o contrato na resposta.
 */
function fictionalDocument(index: number): string {
  const base = `AXEX${String(index).padStart(4, '0')}0001`
  for (let check = 0; check < 100; check++) {
    const candidate = base + String(check).padStart(2, '0')
    if (cnpjValido(candidate)) return candidate
  }
  throw new Error(`Sem dígitos verificadores para ${base}`)
}

type CustomerPlan = Pick<DemoCustomer, 'team' | 'origin' | 'status'> &
  Pick<DemoCustomer, 'createdBy' | 'approved' | 'rejectionReason'>

const portfolio = (team: Team, status: CustomerStatus = 'active'): CustomerPlan => ({
  team,
  origin: 'portfolio',
  status,
})
const prospect = (seller: SellerKey, status: CustomerStatus): CustomerPlan => ({
  team: seller.team,
  origin: 'prospect',
  status,
  createdBy: seller.registration,
})

// Com o Cliente de demonstração de cada Equipe, são 24 de carteira ativos: 12 por Equipe.
const CUSTOMER_PLANS: CustomerPlan[] = [
  ...Array.from({ length: 11 }, (): CustomerPlan[] => [portfolio('A'), portfolio('B')]).flat(),
  portfolio('A', 'inactive'),
  portfolio('B', 'inactive'),
  prospect(SHOWCASE_SELLER, 'pending_approval'),
  prospect(ANA, 'pending_approval'),
  prospect(CAIO, 'pending_approval'),
  prospect(LIA, 'pending_approval'),
  { ...prospect(SHOWCASE_SELLER, 'active'), approved: true },
  { ...prospect(DAVI, 'active'), approved: true },
  {
    ...prospect(ANA, 'rejected'),
    rejectionReason: 'Fora da área atendida pela Equipe',
  },
]

const NAME_BY_TEAM: Record<Team, string> = { A: 'Exemplo', B: 'Modelo' }

function buildDemoCustomers(): { demo: DemoCustomer[]; others: DemoCustomer[] } {
  const random = randomFrom(SEED)

  const contact = (index: number, team: Team) => ({
    document: fictionalDocument(index),
    phone: `6290000${String(index).padStart(4, '0')}`,
    contactName: `Contato ${NAME_BY_TEAM[team]}`,
    zipCode: `74${String(index).padStart(3, '0')}000`,
    street: 'Rua Exemplo',
    number: String(100 + Math.floor(random() * 900)),
  })

  // O Cliente de demonstração é um por Equipe, na mesma coordenada: uma rota só pode ter Clientes
  // da Equipe do Vendedor (docs/05-modelo-dados), e há Vendedores de teste nas duas.
  const demo = (['A', 'B'] as const).map((team, index): DemoCustomer => {
    const tradeName = `Cliente de Demonstração ${NAME_BY_TEAM[team]}`
    return {
      ...contact(index + 1, team),
      ...DEFAULT_DEMO_LOCATION,
      team,
      legalName: `${tradeName} Equipe ${team} Ltda`,
      tradeName,
      district: 'Setor Central',
      origin: 'portfolio',
      status: 'active',
    }
  })

  const others = CUSTOMER_PLANS.map((plan, index): DemoCustomer => {
    const [district, latitude, longitude] = DISTRICTS[
      index % DISTRICTS.length
    ] as (typeof DISTRICTS)[number]
    const business = BUSINESSES[index % BUSINESSES.length]
    const tradeName = `${business} ${NAME_BY_TEAM[plan.team]} ${district}`
    return {
      ...plan,
      ...contact(index + 3, plan.team),
      // Até uns 200 m do centro do bairro, para dois Clientes do mesmo bairro não coincidirem.
      latitude: latitude + (random() - 0.5) * 0.004,
      longitude: longitude + (random() - 0.5) * 0.004,
      legalName: `${tradeName} Ltda`,
      tradeName,
      district,
    }
  })

  return { demo, others }
}

const { demo, others } = buildDemoCustomers()

/** Os Clientes de demonstração, um por Equipe. */
export const DEMONSTRATION_CUSTOMERS: readonly DemoCustomer[] = demo
/** Toda a massa de Clientes, inclusive os de demonstração. */
export const SEEDED_CUSTOMERS: readonly DemoCustomer[] = [...demo, ...others]

export function demonstrationCustomerOf(team: Team): DemoCustomer {
  return demo.find((customer) => customer.team === team) as DemoCustomer
}

const SHOWCASE_STOPS = 6
const TEST_STOPS_AFTER_DEMO = 4
/** Mais que o raio padrão de 100 m: quem está no Cliente de demonstração fica Fora do Raio. */
const MIN_DISTANCE_FROM_DEMONSTRATION_METERS = 200

/**
 * Documentos dos Clientes da rota, em ordem: um de cada faixa de distância de `origin`, a posição
 * atual do Cliente de demonstração, do mais perto para o mais longe. O Vendedor de teste começa
 * pelo de demonstração.
 */
export function routePlan(seller: SellerKey, dayOffset: number, origin: Coordinates): string[] {
  const random = randomFrom(SEED + Number(seller.registration) * 10 + dayOffset)
  const candidates = others
    .filter((c) => c.team === seller.team && c.origin === 'portfolio' && c.status === 'active')
    .map((customer) => ({
      document: customer.document,
      distance: distanceInMeters(origin, customer),
    }))
    .filter(({ distance }) => distance > MIN_DISTANCE_FROM_DEMONSTRATION_METERS)
    .sort((a, b) => a.distance - b.distance)

  const showcase = seller.registration === SHOWCASE_SELLER.registration

  const stops = showcase ? SHOWCASE_STOPS : TEST_STOPS_AFTER_DEMO
  const picked = Array.from({ length: stops }, (_, stop) => {
    const start = Math.floor((stop * candidates.length) / stops)
    const end = Math.floor(((stop + 1) * candidates.length) / stops)
    return candidates[start + Math.floor(random() * (end - start))]?.document as string
  })

  return showcase ? picked : [demonstrationCustomerOf(seller.team).document, ...picked]
}
