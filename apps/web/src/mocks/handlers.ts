import {
  type Customer,
  type CustomerFilters,
  createRouteBodySchema,
  customerFiltersSchema,
  customerInputSchema,
  customerRejectionSchema,
  customerStatusChangeSchema,
  type DashboardSummary,
  dashboardFiltersSchema,
  type ErroDeCampo,
  errosDeValidacao,
  type Loan,
  type LoanDetail,
  loanEndSchema,
  loanFiltersSchema,
  loanInputSchema,
  loginBodySchema,
  normalizarDocumento,
  type Page,
  type PosMaterial,
  type Product,
  posMaterialFiltersSchema,
  posMaterialInputSchema,
  posMaterialStatusChangeSchema,
  productFiltersSchema,
  productInputSchema,
  productStatusChangeSchema,
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
  comodatosMock,
  materiaisMock,
  type PedidoSimulado,
  pedidosMock,
  produtosMock,
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
let produtos: Product[] = structuredClone(produtosMock)
let materiais: PosMaterial[] = structuredClone(materiaisMock)
let comodatos: Loan[] = structuredClone(comodatosMock)
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

function skuEmUso(sku: string, idIgnorado?: string): boolean {
  const normalizado = sku.trim().toUpperCase()
  return produtos.some((p) => p.sku.toUpperCase() === normalizado && p.id !== idIgnorado)
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

/** Comodato com material e cliente associados. */
function detalheComodato(comodato: Loan): LoanDetail {
  const material = materiais.find((m) => m.id === comodato.materialId)
  const customer = clientes.find((c) => c.id === comodato.customerId)
  return { ...comodato, material, customer }
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

  http.post('/v1/customers/:id/approval', async ({ request, params }) => {
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
    if (atual.origin !== 'prospect' || atual.status !== 'pending_approval') {
      return problema(409, 'TRANSICAO_INVALIDA', 'Transição inválida', {
        detail: 'Só prospecção com aprovação pendente pode ser aprovada.',
      })
    }
    const agoraIso = agora()
    const atualizado: Customer = {
      ...atual,
      status: 'active',
      approvedById: usuario.id,
      approvedAt: agoraIso,
      updatedAt: agoraIso,
    }
    clientes = clientes.map((c) => (c.id === atual.id ? atualizado : c))
    return HttpResponse.json(atualizado)
  }),

  http.post('/v1/customers/:id/rejection', async ({ request, params }) => {
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
    const corpo = customerRejectionSchema.safeParse(await request.json().catch(() => undefined))
    if (!corpo.success) {
      return validacao(errosDeValidacao(corpo.error))
    }
    if (atual.origin !== 'prospect' || atual.status !== 'pending_approval') {
      return problema(409, 'TRANSICAO_INVALIDA', 'Transição inválida', {
        detail: 'Só prospecção com aprovação pendente pode ser rejeitada.',
      })
    }
    const agoraIso = agora()
    const atualizado: Customer = {
      ...atual,
      status: 'rejected',
      rejectionReason: corpo.data.reason,
      updatedAt: agoraIso,
    }
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

  // Catálogo de produtos (RF20, #44): Gestão de itens comercializados pelo Administrador.
  http.get('/v1/products', async ({ request }) => {
    await delay(200)
    const usuario = usuarioDaRequisicao(request)
    if (!usuario) {
      return naoAutenticado()
    }
    const params = Object.fromEntries(new URL(request.url).searchParams)
    const consulta = productFiltersSchema.safeParse(params)
    if (!consulta.success) {
      return validacao(errosDeValidacao(consulta.error))
    }
    const { search, category, active, sortBy, order, page: numPagina, perPage } = consulta.data
    const termo = search?.trim().toLowerCase()
    const direcao = order === 'desc' ? -1 : 1

    const filtrados = produtos
      .filter((p) => {
        if (active !== undefined && p.active !== active) return false
        if (category && p.category.toLowerCase() !== category.trim().toLowerCase()) return false
        if (termo) {
          const casouNome = p.name.toLowerCase().includes(termo)
          const casouSku = p.sku.toLowerCase().includes(termo)
          const casouCategoria = p.category.toLowerCase().includes(termo)
          if (!casouNome && !casouSku && !casouCategoria) return false
        }
        return true
      })
      .sort((a, b) => {
        const valA = a[sortBy]
        const valB = b[sortBy]
        if (typeof valA === 'string' && typeof valB === 'string') {
          return direcao * valA.localeCompare(valB, 'pt-BR') || a.id.localeCompare(b.id)
        }
        if (typeof valA === 'number' && typeof valB === 'number') {
          return direcao * (valA - valB) || a.id.localeCompare(b.id)
        }
        return 0
      })

    return HttpResponse.json(pagina(filtrados, numPagina, perPage))
  }),

  http.get('/v1/products/:id', async ({ request, params }) => {
    await delay(150)
    const usuario = usuarioDaRequisicao(request)
    if (!usuario) {
      return naoAutenticado()
    }
    const encontrado = produtos.find((p) => p.id === String(params.id))
    if (!encontrado) {
      return problema(404, 'NAO_ENCONTRADO', 'Produto não encontrado')
    }
    return HttpResponse.json(encontrado)
  }),

  http.post('/v1/products', async ({ request }) => {
    await delay(300)
    const usuario = usuarioDaRequisicao(request)
    if (!usuario) {
      return naoAutenticado()
    }
    if (usuario.role !== 'administrator') {
      return semPermissao()
    }
    const corpo = productInputSchema.safeParse(await request.json().catch(() => undefined))
    if (!corpo.success) {
      return validacao(errosDeValidacao(corpo.error))
    }
    if (skuEmUso(corpo.data.sku)) {
      return problema(409, 'SKU_JA_CADASTRADO', 'SKU já cadastrado', {
        detail: 'Já existe um produto com este SKU no catálogo.',
      })
    }
    const instante = agora()
    const novo: Product = {
      id: crypto.randomUUID(),
      sku: corpo.data.sku.trim().toUpperCase(),
      name: corpo.data.name.trim(),
      category: corpo.data.category.trim(),
      unitPriceCents: corpo.data.unitPriceCents,
      referenceStock: corpo.data.referenceStock,
      imageUrl: corpo.data.imageUrl || null,
      active: true,
      createdAt: instante,
      updatedAt: instante,
    }
    produtos = [...produtos, novo]
    return HttpResponse.json(novo, { status: 201 })
  }),

  http.put('/v1/products/:id', async ({ request, params }) => {
    await delay(300)
    const usuario = usuarioDaRequisicao(request)
    if (!usuario) {
      return naoAutenticado()
    }
    if (usuario.role !== 'administrator') {
      return semPermissao()
    }
    const atual = produtos.find((p) => p.id === String(params.id))
    if (!atual) {
      return problema(404, 'NAO_ENCONTRADO', 'Produto não encontrado')
    }
    const corpo = productInputSchema.safeParse(await request.json().catch(() => undefined))
    if (!corpo.success) {
      return validacao(errosDeValidacao(corpo.error))
    }
    if (skuEmUso(corpo.data.sku, atual.id)) {
      return problema(409, 'SKU_JA_CADASTRADO', 'SKU já cadastrado', {
        detail: 'Já existe outro produto com este SKU no catálogo.',
      })
    }
    const atualizado: Product = {
      ...atual,
      sku: corpo.data.sku.trim().toUpperCase(),
      name: corpo.data.name.trim(),
      category: corpo.data.category.trim(),
      unitPriceCents: corpo.data.unitPriceCents,
      referenceStock: corpo.data.referenceStock,
      imageUrl: corpo.data.imageUrl || null,
      updatedAt: agora(),
    }
    produtos = produtos.map((p) => (p.id === atual.id ? atualizado : p))
    return HttpResponse.json(atualizado)
  }),

  http.patch('/v1/products/:id/status', async ({ request, params }) => {
    await delay(200)
    const usuario = usuarioDaRequisicao(request)
    if (!usuario) {
      return naoAutenticado()
    }
    if (usuario.role !== 'administrator') {
      return semPermissao()
    }
    const atual = produtos.find((p) => p.id === String(params.id))
    if (!atual) {
      return problema(404, 'NAO_ENCONTRADO', 'Produto não encontrado')
    }
    const corpo = productStatusChangeSchema.safeParse(await request.json().catch(() => undefined))
    if (!corpo.success) {
      return validacao(errosDeValidacao(corpo.error))
    }
    const atualizado: Product = {
      ...atual,
      active: corpo.data.active,
      updatedAt: agora(),
    }
    produtos = produtos.map((p) => (p.id === atual.id ? atualizado : p))
    return HttpResponse.json(atualizado)
  }),

  // --- Materiais de PDV (RF16) ---

  http.get('/v1/pos-materials', async ({ request }) => {
    await delay(250)
    const usuario = usuarioDaRequisicao(request)
    if (!usuario) {
      return naoAutenticado()
    }
    const url = new URL(request.url)
    const query = Object.fromEntries(url.searchParams)
    const parse = posMaterialFiltersSchema.safeParse(query)
    if (!parse.success) {
      return validacao(errosDeValidacao(parse.error))
    }
    const filtros = parse.data
    const termo = filtros.search?.toLowerCase()
    const direcao = filtros.order === 'desc' ? -1 : 1
    const filtrados = materiais
      .filter(
        (m) =>
          (!termo ||
            m.name.toLowerCase().includes(termo) ||
            m.category.toLowerCase().includes(termo)) &&
          (!filtros.category || m.category.toLowerCase() === filtros.category.toLowerCase()) &&
          (filtros.active === undefined || m.active === filtros.active),
      )
      .sort(
        (a, b) =>
          direcao * String(a[filtros.sortBy]).localeCompare(String(b[filtros.sortBy]), 'pt-BR') ||
          a.id.localeCompare(b.id),
      )
    return HttpResponse.json(pagina(filtrados, filtros.page, filtros.perPage))
  }),

  http.get('/v1/pos-materials/:id', async ({ request, params }) => {
    await delay(150)
    const usuario = usuarioDaRequisicao(request)
    if (!usuario) {
      return naoAutenticado()
    }
    const encontrado = materiais.find((m) => m.id === String(params.id))
    if (!encontrado) {
      return problema(404, 'NAO_ENCONTRADO', 'Material não encontrado')
    }
    return HttpResponse.json(encontrado)
  }),

  http.post('/v1/pos-materials', async ({ request }) => {
    await delay(300)
    const usuario = usuarioDaRequisicao(request)
    if (!usuario) {
      return naoAutenticado()
    }
    if (usuario.role !== 'administrator') {
      return semPermissao()
    }
    const corpo = posMaterialInputSchema.safeParse(await request.json().catch(() => undefined))
    if (!corpo.success) {
      return validacao(errosDeValidacao(corpo.error))
    }
    const instante = agora()
    const novo: PosMaterial = {
      id: crypto.randomUUID(),
      name: corpo.data.name.trim(),
      category: corpo.data.category.trim(),
      active: true,
      createdAt: instante,
      updatedAt: instante,
    }
    materiais = [...materiais, novo]
    return HttpResponse.json(novo, { status: 201 })
  }),

  http.put('/v1/pos-materials/:id', async ({ request, params }) => {
    await delay(300)
    const usuario = usuarioDaRequisicao(request)
    if (!usuario) {
      return naoAutenticado()
    }
    if (usuario.role !== 'administrator') {
      return semPermissao()
    }
    const atual = materiais.find((m) => m.id === String(params.id))
    if (!atual) {
      return problema(404, 'NAO_ENCONTRADO', 'Material não encontrado')
    }
    const corpo = posMaterialInputSchema.safeParse(await request.json().catch(() => undefined))
    if (!corpo.success) {
      return validacao(errosDeValidacao(corpo.error))
    }
    const atualizado: PosMaterial = {
      ...atual,
      name: corpo.data.name.trim(),
      category: corpo.data.category.trim(),
      updatedAt: agora(),
    }
    materiais = materiais.map((m) => (m.id === atual.id ? atualizado : m))
    return HttpResponse.json(atualizado)
  }),

  http.patch('/v1/pos-materials/:id/status', async ({ request, params }) => {
    await delay(200)
    const usuario = usuarioDaRequisicao(request)
    if (!usuario) {
      return naoAutenticado()
    }
    if (usuario.role !== 'administrator') {
      return semPermissao()
    }
    const atual = materiais.find((m) => m.id === String(params.id))
    if (!atual) {
      return problema(404, 'NAO_ENCONTRADO', 'Material não encontrado')
    }
    const corpo = posMaterialStatusChangeSchema.safeParse(
      await request.json().catch(() => undefined),
    )
    if (!corpo.success) {
      return validacao(errosDeValidacao(corpo.error))
    }
    const atualizado: PosMaterial = {
      ...atual,
      active: corpo.data.active,
      updatedAt: agora(),
    }
    materiais = materiais.map((m) => (m.id === atual.id ? atualizado : m))
    return HttpResponse.json(atualizado)
  }),

  http.delete('/v1/pos-materials/:id', async ({ request, params }) => {
    await delay(250)
    const usuario = usuarioDaRequisicao(request)
    if (!usuario) {
      return naoAutenticado()
    }
    if (usuario.role !== 'administrator') {
      return semPermissao()
    }
    const atual = materiais.find((m) => m.id === String(params.id))
    if (!atual) {
      return problema(404, 'NAO_ENCONTRADO', 'Material não encontrado')
    }
    // Regra do modelo de dados: exclusão real permitida APENAS sem comodatos ativos vinculados.
    const temComodatoAtivo = comodatos.some((c) => c.materialId === atual.id && c.endedAt === null)
    if (temComodatoAtivo) {
      return problema(409, 'MATERIAL_EM_USO', 'Material em uso', {
        detail:
          'Não é possível excluir material com comodatos ativos vinculados. Encerre os comodatos antes de excluir.',
      })
    }
    materiais = materiais.filter((m) => m.id !== atual.id)
    return new HttpResponse(null, { status: 204 })
  }),

  // --- Comodatos por Cliente (RF17) ---

  http.get('/v1/loans', async ({ request }) => {
    await delay(250)
    const usuario = usuarioDaRequisicao(request)
    if (!usuario) {
      return naoAutenticado()
    }
    if (
      usuario.role !== 'administrator' &&
      usuario.role !== 'coordinator' &&
      usuario.role !== 'director'
    ) {
      return semPermissao()
    }
    const url = new URL(request.url)
    const query = Object.fromEntries(url.searchParams)
    const parse = loanFiltersSchema.safeParse(query)
    if (!parse.success) {
      return validacao(errosDeValidacao(parse.error))
    }
    const filtros = parse.data
    // Escopo por perfil: Administrador e Diretor veem todos; Coordenador vê apenas comodatos dos clientes da sua equipe.
    let base = comodatos
    if (usuario.role === 'coordinator') {
      const idsClientesEquipe = new Set(daEquipe(usuario).map((c) => c.id))
      base = base.filter((c) => idsClientesEquipe.has(c.customerId))
    }
    const enriquecidos = base.map(detalheComodato)
    const termo = filtros.search?.toLowerCase()
    const direcao = filtros.order === 'desc' ? -1 : 1
    const filtrados = enriquecidos
      .filter(
        (l) =>
          (!filtros.customerId || l.customerId === filtros.customerId) &&
          (!filtros.materialId || l.materialId === filtros.materialId) &&
          (filtros.activeOnly === undefined || (filtros.activeOnly ? l.endedAt === null : true)) &&
          (!termo ||
            l.serialNumber.toLowerCase().includes(termo) ||
            l.customer?.tradeName.toLowerCase().includes(termo) ||
            l.customer?.legalName.toLowerCase().includes(termo) ||
            l.material?.name.toLowerCase().includes(termo)),
      )
      .sort(
        (a, b) =>
          direcao *
            String(a[filtros.sortBy] ?? '').localeCompare(
              String(b[filtros.sortBy] ?? ''),
              'pt-BR',
            ) || a.id.localeCompare(b.id),
      )
    return HttpResponse.json(pagina(filtrados, filtros.page, filtros.perPage))
  }),

  http.post('/v1/loans', async ({ request }) => {
    await delay(300)
    const usuario = usuarioDaRequisicao(request)
    if (!usuario) {
      return naoAutenticado()
    }
    if (usuario.role !== 'administrator') {
      return semPermissao()
    }
    const corpo = loanInputSchema.safeParse(await request.json().catch(() => undefined))
    if (!corpo.success) {
      return validacao(errosDeValidacao(corpo.error))
    }
    const material = materiais.find((m) => m.id === corpo.data.materialId)
    if (!material) {
      return validacao([{ campo: 'materialId', mensagem: 'Material não encontrado no catálogo' }])
    }
    if (!material.active) {
      return validacao([
        { campo: 'materialId', mensagem: 'Não é possível vincular material inativo' },
      ])
    }
    const cliente = clientes.find((c) => c.id === corpo.data.customerId)
    if (!cliente) {
      return validacao([{ campo: 'customerId', mensagem: 'Cliente não encontrado' }])
    }
    if (cliente.status !== 'active') {
      return validacao([
        { campo: 'customerId', mensagem: 'O cliente precisa estar ativo para receber comodato' },
      ])
    }
    const serialNormalizado = corpo.data.serialNumber.trim()
    const serialRepetidoAtivo = comodatos.some(
      (c) =>
        c.serialNumber.trim().toLowerCase() === serialNormalizado.toLowerCase() &&
        c.endedAt === null,
    )
    if (serialRepetidoAtivo) {
      return problema(409, 'NUMERO_SERIE_EM_USO', 'Patrimônio já em uso', {
        detail: 'Já existe um comodato ativo com este patrimônio ou número de série.',
      })
    }
    const instante = agora()
    const novo: Loan = {
      id: crypto.randomUUID(),
      materialId: corpo.data.materialId,
      customerId: corpo.data.customerId,
      serialNumber: serialNormalizado,
      installedAt: corpo.data.installedAt,
      endedAt: null,
      createdAt: instante,
      updatedAt: instante,
    }
    comodatos = [...comodatos, novo]
    return HttpResponse.json(detalheComodato(novo), { status: 201 })
  }),

  http.patch('/v1/loans/:id/end', async ({ request, params }) => {
    await delay(300)
    const usuario = usuarioDaRequisicao(request)
    if (!usuario) {
      return naoAutenticado()
    }
    if (usuario.role !== 'administrator') {
      return semPermissao()
    }
    const atual = comodatos.find((c) => c.id === String(params.id))
    if (!atual) {
      return problema(404, 'NAO_ENCONTRADO', 'Comodato não encontrado')
    }
    if (atual.endedAt !== null) {
      return problema(409, 'TRANSICAO_INVALIDA', 'Comodato já encerrado', {
        detail: 'Este comodato já foi encerrado anteriormente.',
      })
    }
    const corpo = loanEndSchema.safeParse(await request.json().catch(() => undefined))
    if (!corpo.success) {
      return validacao(errosDeValidacao(corpo.error))
    }
    if (corpo.data.endedAt < atual.installedAt) {
      return validacao([
        {
          campo: 'endedAt',
          mensagem: 'A data de encerramento não pode ser anterior à data de instalação.',
        },
      ])
    }
    const atualizado: Loan = {
      ...atual,
      endedAt: corpo.data.endedAt,
      updatedAt: agora(),
    }
    comodatos = comodatos.map((c) => (c.id === atual.id ? atualizado : c))
    return HttpResponse.json(detalheComodato(atualizado))
  }),
]
