import {
  type Customer,
  type CustomerFilters,
  customerFiltersSchema,
  customerInputSchema,
  customerStatusChangeSchema,
  type ErroDeCampo,
  errosDeValidacao,
  loginBodySchema,
  normalizarDocumento,
  type Page,
  type Session,
  type User,
} from '@axis/contracts'
import { delay, HttpResponse, http } from 'msw'
import { clientesMock, SENHA_DEMO, usuariosMock } from './data'

const DURACAO_DA_SESSAO_MS = 8 * 60 * 60 * 1000
const PREFIXO_DO_TOKEN = 'Bearer token-simulado-'

// "Banco" em memória: volta aos dados de exemplo quando a página recarrega.
let clientes: Customer[] = structuredClone(clientesMock)

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
const documentoRepetido = () =>
  problema(409, 'DOCUMENTO_JA_CADASTRADO', 'Documento já cadastrado', {
    detail: 'Já existe um cliente com este CPF/CNPJ.',
    erros: [{ campo: 'document', mensagem: 'Já existe um cliente com este CPF/CNPJ.' }],
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

function validacao(erros: ErroDeCampo[]) {
  return problema(422, 'VALIDACAO', 'Dados inválidos', { erros })
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
    const encontrados = filtrar(daEquipe(usuario), consulta.data)
    const { page, perPage } = consulta.data
    const inicio = (page - 1) * perPage
    const corpo: Page<Customer> = {
      items: encontrados.slice(inicio, inicio + perPage),
      total: encontrados.length,
      page,
      perPage,
    }
    return HttpResponse.json(corpo)
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
]
