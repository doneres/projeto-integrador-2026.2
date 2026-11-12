import {
  type Customer,
  type CustomerFilters,
  createRouteBodySchema,
  customerFiltersSchema,
  customerInputSchema,
  customerStatusChangeSchema,
  type DashboardSummary,
  dashboardFiltersSchema,
  type ErroDeCampo,
  errosDeValidacao,
  loginBodySchema,
  normalizarDocumento,
  type Page,
  type Route,
  type RouteDetail,
  routeFiltersSchema,
  type Session,
  type User,
  userFiltersSchema,
  type Visit,
  visitStatusOf,
} from '@axis/contracts'
import { delay, HttpResponse, http } from 'msw'
import { hojeEmSaoPaulo } from '../lib/datas'
import {
  clientesMock,
  type PedidoSimulado,
  pedidosMock,
  rotasMock,
  SENHA_DEMO,
  usuariosMock,
  visitasMock,
} from './data'

const DURACAO_DA_SESSAO_MS = 8 * 60 * 60 * 1000
const PREFIXO_DO_TOKEN = 'Bearer token-simulado-'

// "Banco" em memória: volta aos dados de exemplo quando a página recarrega.
let clientes: Customer[] = structuredClone(clientesMock)
let rotas: Route[] = structuredClone(rotasMock)
let visitas: Visit[] = structuredClone(visitasMock)
const pedidos: PedidoSimulado[] = structuredClone(pedidosMock)

const agora = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z')

function problema(
  status: number,
  codigo: string,
  title: string,
  extras: { detail?: string; erros?: ErroDeCampo[] } = {},
) {
  return HttpResponse.json(
    { type: 'about:blank', title, status, codigo, ...extras },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  )
}

function usuarioDaRequisicao(request: Request): User | undefined {
  const cabecalho = request.headers.get('Authorization') ?? ''
  if (!cabecalho.startsWith(PREFIXO_DO_TOKEN)) {
    return undefined
  }
  const id = cabecalho.slice(PREFIXO_DO_TOKEN.length)
  return usuariosMock.find((usuario) => usuario.id === id)
}

const naoAutenticado = () =>
  problema(401, 'NAO_AUTENTICADO', 'Não autenticado', { detail: 'Entre novamente para continuar.' })
const naoEncontrado = () =>
  problema(404, 'NAO_ENCONTRADO', 'Não encontrado', { detail: 'Cliente não encontrado.' })
const semPermissao = () =>
  problema(403, 'SEM_PERMISSAO', 'Sem permissão', {
    detail: 'Seu perfil não tem acesso a este recurso.',
  })
// Como a API real: o 409 traz só `codigo` e `detail`, sem a lista `erros` (que é do 422).
const documentoRepetido = () =>
  problema(409, 'DOCUMENTO_JA_CADASTRADO', 'Documento já cadastrado', {
    detail: 'Já existe um cliente com este CPF/CNPJ.',
  })

/** Como a API real (#58): o Coordenador vê só os clientes da sua Equipe. */
function daEquipe(usuario: User): Customer[] {
  return usuario.role === 'director'
    ? clientes
    : clientes.filter((c) => c.coordinatorId === usuario.id)
}

/** Mesma busca, filtros e ordenação de GET /v1/customers. O bairro, como na API, é exato. */
function filtrar(lista: Customer[], filtros: CustomerFilters): Customer[] {
  const termo = filtros.search?.toLowerCase()
  const termoDocumento = filtros.search ? normalizarDocumento(filtros.search) : ''
  const direcao = filtros.order === 'desc' ? -1 : 1
  return lista
    .filter(
      (c) =>
        (!termo ||
          c.tradeName.toLowerCase().includes(termo) ||
          c.legalName.toLowerCase().includes(termo) ||
          (termoDocumento !== '' && c.document.includes(termoDocumento))) &&
        (!filtros.status || c.status === filtros.status) &&
        (!filtros.origin || c.origin === filtros.origin) &&
        (!filtros.district || c.district === filtros.district),
    )
    .sort(
      (a, b) =>
        direcao * String(a[filtros.sortBy]).localeCompare(String(b[filtros.sortBy]), 'pt-BR') ||
        a.id.localeCompare(b.id),
    )
}

async function lerDadosCliente(request: Request) {
  return customerInputSchema.safeParse(await request.json().catch(() => undefined))
}

function documentoEmUso(documento: string, idIgnorado?: string): boolean {
  return clientes.some(
    (c) => c.document === documento && c.status !== 'rejected' && c.id !== idIgnorado,
  )
}

function pagina<T>(itens: T[], page: number, perPage: number): Page<T> {
  const inicio = (page - 1) * perPage
  return { items: itens.slice(inicio, inicio + perPage), total: itens.length, page, perPage }
}

/** Vendedores que o usuário enxerga: o Coordenador, os da Equipe; o Diretor, todos. */
function idsDaEquipe(usuario: User): string[] {
  return usuariosMock
    .filter(
      (u) => u.role === 'seller' && (usuario.role === 'director' || u.coordinatorId === usuario.id),
    )
    .map((u) => u.id)
}

/** Escopo de rotas da API (#58): Vendedor, as suas; Coordenador, a Equipe; Diretor, todas. */
function rotasVisiveis(usuario: User): Route[] {
  if (usuario.role === 'seller') {
    return rotas.filter((r) => r.sellerId === usuario.id)
  }
  const equipe = idsDaEquipe(usuario)
  return rotas.filter((r) => equipe.includes(r.sellerId))
}

/** A rota com as Visitas pela posição, o estado derivado e o Cliente, como GET /v1/routes/{id}. */
function detalhe(rota: Route): RouteDetail {
  const daRota = visitas
    .filter((v) => v.routeId === rota.id)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
  return {
    ...rota,
    visits: daRota.map((v) => {
      const cliente = clientes.find((c) => c.id === v.customerId)
      if (!cliente) {
        throw new Error(`Visita ${v.id} aponta para um cliente que não existe no mock`)
      }
      return { ...v, status: visitStatusOf(v), customer: cliente }
    }),
  }
}

const rotaNaoEncontrada = () =>
  problema(404, 'NAO_ENCONTRADO', 'Não encontrado', { detail: 'Rota não encontrada.' })

function validacao(erros: ErroDeCampo[]) {
  return problema(422, 'VALIDACAO', 'Dados inválidos', { erros })
}

/** Resumo consolidado do dia e faturamento do mês para o escopo do usuário (#40). */
function resumoDoPainel(usuario: User, date: string): DashboardSummary {
  const month = date.slice(0, 7)
  const vendedores = usuariosMock
    .filter(
      (u) => u.role === 'seller' && (usuario.role === 'director' || u.coordinatorId === usuario.id),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const idsVendedores = new Set(vendedores.map((v) => v.id))

  const rotasDoDia = rotas.filter((r) => r.date === date && idsVendedores.has(r.sellerId))
  const rotaPorVendedor = new Map(rotasDoDia.map((r) => [r.sellerId, r.id]))

  const totais = { planned: 0, completed: 0, inProgress: 0, notPerformed: 0, pending: 0 }

  const visitsBySeller = vendedores.map((vendedor) => {
    const rotaId = rotaPorVendedor.get(vendedor.id)
    const visitasDoVendedor = rotaId ? visitas.filter((v) => v.routeId === rotaId) : []
    const contagem = {
      sellerId: vendedor.id,
      sellerName: vendedor.name,
      planned: visitasDoVendedor.length,
      completed: 0,
      inProgress: 0,
      notPerformed: 0,
    }
    totais.planned += visitasDoVendedor.length
    for (const v of visitasDoVendedor) {
      const status = visitStatusOf(v)
      if (status === 'completed') {
        contagem.completed += 1
        totais.completed += 1
      } else if (status === 'in_progress') {
        contagem.inProgress += 1
        totais.inProgress += 1
      } else if (status === 'not_performed') {
        contagem.notPerformed += 1
        totais.notPerformed += 1
      } else {
        totais.pending += 1
      }
    }
    return contagem
  })

  const pedidosDoMes = pedidos.filter(
    (p) =>
      idsVendedores.has(p.sellerId) && hojeEmSaoPaulo(new Date(p.occurredAt)).startsWith(month),
  )
  const revenueCents = pedidosDoMes.reduce((soma, p) => soma + p.totalCents, 0)

  return {
    date,
    month,
    visits: totais,
    revenueCents,
    ordersCount: pedidosDoMes.length,
    visitsBySeller,
  }
}

// Cada handler imita um endpoint do contrato da API (/v1/...).
export const handlers = [
  http.post('/v1/auth/login', async ({ request }) => {
    await delay(400)
    const corpo = loginBodySchema.safeParse(await request.json().catch(() => undefined))
    if (!corpo.success) {
      return validacao(errosDeValidacao(corpo.error))
    }
    const { identifier, password } = corpo.data
    const usuario = usuariosMock.find(
      (u) => u.email.toLowerCase() === identifier.toLowerCase() || u.registration === identifier,
    )
    if (!usuario || password !== SENHA_DEMO) {
      return problema(401, 'CREDENCIAIS_INVALIDAS', 'Credenciais inválidas', {
        detail: 'E-mail/matrícula ou senha incorretos.',
      })
    }
    const expiresAt = new Date(Date.now() + DURACAO_DA_SESSAO_MS)
      .toISOString()
      .replace(/\.\d+Z$/, 'Z')
    const sessao: Session = { token: `token-simulado-${usuario.id}`, expiresAt, user: usuario }
    return HttpResponse.json(sessao)
  }),

  http.get('/v1/customers', async ({ request }) => {
    await delay(300)
    const usuario = usuarioDaRequisicao(request)
    if (!usuario) {
      return naoAutenticado()
    }
    const consulta = customerFiltersSchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    )
    if (!consulta.success) {
      return validacao(errosDeValidacao(consulta.error))
    }
    const { page, perPage } = consulta.data
    return HttpResponse.json(pagina(filtrar(daEquipe(usuario), consulta.data), page, perPage))
  }),

  http.get('/v1/customers/:id', async ({ request, params }) => {
    await delay(200)
    const usuario = usuarioDaRequisicao(request)
    if (!usuario) {
      return naoAutenticado()
    }
    const cliente = daEquipe(usuario).find((c) => c.id === String(params.id))
    return cliente ? HttpResponse.json(cliente) : naoEncontrado()
  }),

  http.post('/v1/customers', async ({ request }) => {
    await delay(400)
    const usuario = usuarioDaRequisicao(request)
    if (!usuario) {
      return naoAutenticado()
    }
    if (usuario.role !== 'coordinator') {
      return semPermissao()
    }
    const dados = await lerDadosCliente(request)
    if (!dados.success) {
      return validacao(errosDeValidacao(dados.error))
    }
    if (documentoEmUso(dados.data.document)) {
      return documentoRepetido()
    }
    const instante = agora()
    // Cliente cadastrado pelo painel nasce de carteira, ativo e da Equipe de quem cadastrou.
    const novo: Customer = {
      ...dados.data,
      complement: dados.data.complement || null,
      id: crypto.randomUUID(),
      origin: 'portfolio',
      status: 'active',
      coordinatorId: usuario.id,
      createdById: usuario.id,
      approvedById: null,
      approvedAt: null,
      rejectionReason: null,
      createdAt: instante,
      updatedAt: instante,
    }
    clientes = [...clientes, novo]
    return HttpResponse.json(novo, { status: 201 })
  }),

  http.put('/v1/customers/:id', async ({ request, params }) => {
    await delay(400)
    const usuario = usuarioDaRequisicao(request)
    if (!usuario) {
      return naoAutenticado()
    }
    if (usuario.role !== 'coordinator') {
      return semPermissao()
    }
    const atual = daEquipe(usuario).find((c) => c.id === String(params.id))
    if (!atual) {
      return naoEncontrado()
    }
    const dados = await lerDadosCliente(request)
    if (!dados.success) {
      return validacao(errosDeValidacao(dados.error))
    }
    if (documentoEmUso(dados.data.document, atual.id)) {
      return documentoRepetido()
    }
    // A edição não muda origem, estado nem dono.
    const atualizado: Customer = {
      ...atual,
      ...dados.data,
      complement: dados.data.complement || null,
      updatedAt: agora(),
    }
    clientes = clientes.map((c) => (c.id === atual.id ? atualizado : c))
    return HttpResponse.json(atualizado)
  }),

  http.patch('/v1/customers/:id/status', async ({ request, params }) => {
    await delay(300)
    const usuario = usuarioDaRequisicao(request)
    if (!usuario) {
      return naoAutenticado()
    }
    if (usuario.role !== 'coordinator') {
      return semPermissao()
    }
    const atual = daEquipe(usuario).find((c) => c.id === String(params.id))
    if (!atual) {
      return naoEncontrado()
    }
    const corpo = customerStatusChangeSchema.safeParse(await request.json().catch(() => undefined))
    if (!corpo.success) {
      return validacao(errosDeValidacao(corpo.error))
    }
    if (atual.status !== 'active' && atual.status !== 'inactive') {
      return problema(409, 'TRANSICAO_INVALIDA', 'Transição inválida', {
        detail: 'Só cliente ativo ou inativo pode ser inativado ou reativado.',
      })
    }
    const atualizado: Customer = { ...atual, status: corpo.data.status, updatedAt: agora() }
    clientes = clientes.map((c) => (c.id === atual.id ? atualizado : c))
    return HttpResponse.json(atualizado)
  }),

  // Usuários e montagem de rota: imitam o que a #79 vai entregar na API real.
  http.get('/v1/users', async ({ request }) => {
    await delay(200)
    const usuario = usuarioDaRequisicao(request)
    if (!usuario) {
      return naoAutenticado()
    }
    if (usuario.role !== 'coordinator' && usuario.role !== 'director') {
      return semPermissao()
    }
    const consulta = userFiltersSchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    )
    if (!consulta.success) {
      return validacao(errosDeValidacao(consulta.error))
    }
    const { role, page, perPage } = consulta.data
    const equipe = idsDaEquipe(usuario)
    const encontrados = usuariosMock
      .filter((u) => equipe.includes(u.id) && (!role || u.role === role))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    return HttpResponse.json(pagina(encontrados, page, perPage))
  }),

  http.get('/v1/routes', async ({ request }) => {
    await delay(300)
    const usuario = usuarioDaRequisicao(request)
    if (!usuario) {
      return naoAutenticado()
    }
    if (usuario.role === 'administrator') {
      return semPermissao()
    }
    const consulta = routeFiltersSchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    )
    if (!consulta.success) {
      return validacao(errosDeValidacao(consulta.error))
    }
    const { date, sellerId, page, perPage } = consulta.data
    const encontradas = rotasVisiveis(usuario)
      .filter((r) => (!date || r.date === date) && (!sellerId || r.sellerId === sellerId))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    return HttpResponse.json(pagina(encontradas, page, perPage))
  }),

  http.get('/v1/routes/:id', async ({ request, params }) => {
    await delay(200)
    const usuario = usuarioDaRequisicao(request)
    if (!usuario) {
      return naoAutenticado()
    }
    const rota = rotasVisiveis(usuario).find((r) => r.id === String(params.id))
    return rota ? HttpResponse.json(detalhe(rota)) : rotaNaoEncontrada()
  }),

  http.post('/v1/routes', async ({ request }) => {
    await delay(400)
    const usuario = usuarioDaRequisicao(request)
    if (!usuario) {
      return naoAutenticado()
    }
    if (usuario.role !== 'coordinator') {
      return semPermissao()
    }
    const corpo = createRouteBodySchema.safeParse(await request.json().catch(() => undefined))
    if (!corpo.success) {
      return validacao(errosDeValidacao(corpo.error))
    }
    const { sellerId, date, customerIds } = corpo.data
    // Regras do modelo de dados (#26): vendedor e clientes da Equipe de quem monta; só cliente
    // ativo entra em rota; uma rota por vendedor por dia.
    if (!idsDaEquipe(usuario).includes(sellerId)) {
      return validacao([{ campo: 'sellerId', mensagem: 'Escolha um vendedor da sua Equipe' }])
    }
    const validos = daEquipe(usuario).filter((c) => c.status === 'active')
    if (!customerIds.every((id) => validos.some((c) => c.id === id))) {
      return validacao([
        { campo: 'customerIds', mensagem: 'Só clientes ativos da sua Equipe entram na rota' },
      ])
    }
    if (rotas.some((r) => r.sellerId === sellerId && r.date === date)) {
      return problema(409, 'ROTA_JA_EXISTE', 'Rota já existe', {
        detail: 'Este vendedor já tem uma rota nesta data.',
      })
    }
    const instante = agora()
    const nova: Route = {
      id: crypto.randomUUID(),
      sellerId,
      date,
      createdById: usuario.id,
      createdAt: instante,
      updatedAt: instante,
    }
    rotas = [...rotas, nova]
    visitas = [
      ...visitas,
      ...customerIds.map(
        (customerId, indice): Visit => ({
          id: crypto.randomUUID(),
          routeId: nova.id,
          customerId,
          position: indice + 1,
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
          createdAt: instante,
          updatedAt: instante,
        }),
      ),
    ]
    return HttpResponse.json(detalhe(nova), { status: 201 })
  }),

  http.get('/v1/dashboard', async ({ request }) => {
    await delay(250)
    const usuario = usuarioDaRequisicao(request)
    if (!usuario) {
      return naoAutenticado()
    }
    if (usuario.role !== 'coordinator' && usuario.role !== 'director') {
      return semPermissao()
    }
    const consulta = dashboardFiltersSchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    )
    if (!consulta.success) {
      return validacao(errosDeValidacao(consulta.error))
    }
    const date = consulta.data.date ?? hojeEmSaoPaulo()
    return HttpResponse.json(resumoDoPainel(usuario, date))
  }),
]
