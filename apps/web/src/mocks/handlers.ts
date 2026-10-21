import {
  alteracaoStatusClienteSchema,
  type Cliente,
  dadosClienteSchema,
  type ErroDeCampo,
  errosDeValidacao,
  type FiltrosClientes,
  filtrosClientesSchema,
  loginSchema,
  normalizarDocumento,
  type Pagina,
  type Sessao,
  type Usuario,
} from '@axis/contracts'
import { delay, HttpResponse, http } from 'msw'
import { clientesMock, SENHA_DEMO, usuariosMock } from './data'

const DURACAO_DA_SESSAO_MS = 8 * 60 * 60 * 1000
const PREFIXO_DO_TOKEN = 'Bearer token-simulado-'

// "Banco" em memória: volta aos dados de exemplo quando a página recarrega.
let clientes: Cliente[] = structuredClone(clientesMock)

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

function usuarioDaRequisicao(request: Request): Usuario | undefined {
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
const documentoRepetido = () =>
  problema(409, 'DOCUMENTO_JA_CADASTRADO', 'Documento já cadastrado', {
    detail: 'Já existe um cliente com este CPF/CNPJ.',
    erros: [{ campo: 'documento', mensagem: 'Já existe um cliente com este CPF/CNPJ.' }],
  })

function filtrar(lista: Cliente[], filtros: FiltrosClientes): Cliente[] {
  const termo = filtros.busca?.toLowerCase()
  const termoDocumento = filtros.busca ? normalizarDocumento(filtros.busca) : ''
  const bairro = filtros.bairro?.toLowerCase()
  return lista
    .filter(
      (c) =>
        (!termo ||
          c.nomeFantasia.toLowerCase().includes(termo) ||
          c.razaoSocial.toLowerCase().includes(termo) ||
          (termoDocumento !== '' && c.documento.includes(termoDocumento))) &&
        (!filtros.status || c.status === filtros.status) &&
        (!filtros.tipo || c.tipo === filtros.tipo) &&
        (!bairro || c.endereco.bairro.toLowerCase().includes(bairro)),
    )
    .sort((a, b) => a.nomeFantasia.localeCompare(b.nomeFantasia, 'pt-BR'))
}

async function lerDadosCliente(request: Request) {
  return dadosClienteSchema.safeParse(await request.json().catch(() => undefined))
}

function documentoEmUso(documento: string, idIgnorado?: string): boolean {
  return clientes.some((c) => c.documento === documento && c.id !== idIgnorado)
}

function validacao(erros: ErroDeCampo[]) {
  return problema(422, 'VALIDACAO', 'Dados inválidos', { erros })
}

// Cada handler imita um endpoint do contrato da API (/v1/...).
export const handlers = [
  http.post('/v1/auth/login', async ({ request }) => {
    await delay(400)
    const corpo = loginSchema.safeParse(await request.json().catch(() => undefined))
    if (!corpo.success) {
      return validacao(errosDeValidacao(corpo.error))
    }
    const { identificador, senha } = corpo.data
    const usuario = usuariosMock.find(
      (u) => u.email.toLowerCase() === identificador.toLowerCase() || u.matricula === identificador,
    )
    if (!usuario || senha !== SENHA_DEMO) {
      return problema(401, 'CREDENCIAIS_INVALIDAS', 'Credenciais inválidas', {
        detail: 'E-mail/matrícula ou senha incorretos.',
      })
    }
    const expiraEm = new Date(Date.now() + DURACAO_DA_SESSAO_MS)
      .toISOString()
      .replace(/\.\d+Z$/, 'Z')
    const sessao: Sessao = { token: `token-simulado-${usuario.id}`, expiraEm, usuario }
    return HttpResponse.json(sessao)
  }),

  http.get('/v1/clientes', async ({ request }) => {
    await delay(300)
    if (!usuarioDaRequisicao(request)) {
      return naoAutenticado()
    }
    const consulta = filtrosClientesSchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    )
    if (!consulta.success) {
      return validacao(errosDeValidacao(consulta.error))
    }
    const encontrados = filtrar(clientes, consulta.data)
    const { pagina, porPagina } = consulta.data
    const inicio = (pagina - 1) * porPagina
    const corpo: Pagina<Cliente> = {
      itens: encontrados.slice(inicio, inicio + porPagina),
      total: encontrados.length,
      pagina,
      porPagina,
    }
    return HttpResponse.json(corpo)
  }),

  http.get('/v1/clientes/:id', async ({ request, params }) => {
    await delay(200)
    if (!usuarioDaRequisicao(request)) {
      return naoAutenticado()
    }
    const cliente = clientes.find((c) => c.id === String(params.id))
    return cliente ? HttpResponse.json(cliente) : naoEncontrado()
  }),

  http.post('/v1/clientes', async ({ request }) => {
    await delay(400)
    if (!usuarioDaRequisicao(request)) {
      return naoAutenticado()
    }
    const dados = await lerDadosCliente(request)
    if (!dados.success) {
      return validacao(errosDeValidacao(dados.error))
    }
    if (documentoEmUso(dados.data.documento)) {
      return documentoRepetido()
    }
    const instante = agora()
    const novo: Cliente = {
      ...dados.data,
      id: crypto.randomUUID(),
      status: 'ativo',
      criadoEm: instante,
      atualizadoEm: instante,
    }
    clientes = [...clientes, novo]
    return HttpResponse.json(novo, { status: 201 })
  }),

  http.put('/v1/clientes/:id', async ({ request, params }) => {
    await delay(400)
    if (!usuarioDaRequisicao(request)) {
      return naoAutenticado()
    }
    const atual = clientes.find((c) => c.id === String(params.id))
    if (!atual) {
      return naoEncontrado()
    }
    const dados = await lerDadosCliente(request)
    if (!dados.success) {
      return validacao(errosDeValidacao(dados.error))
    }
    if (documentoEmUso(dados.data.documento, atual.id)) {
      return documentoRepetido()
    }
    const atualizado: Cliente = { ...atual, ...dados.data, atualizadoEm: agora() }
    clientes = clientes.map((c) => (c.id === atual.id ? atualizado : c))
    return HttpResponse.json(atualizado)
  }),

  http.patch('/v1/clientes/:id/status', async ({ request, params }) => {
    await delay(300)
    if (!usuarioDaRequisicao(request)) {
      return naoAutenticado()
    }
    const atual = clientes.find((c) => c.id === String(params.id))
    if (!atual) {
      return naoEncontrado()
    }
    const corpo = alteracaoStatusClienteSchema.safeParse(
      await request.json().catch(() => undefined),
    )
    if (!corpo.success) {
      return validacao(errosDeValidacao(corpo.error))
    }
    const atualizado: Cliente = { ...atual, status: corpo.data.status, atualizadoEm: agora() }
    clientes = clientes.map((c) => (c.id === atual.id ? atualizado : c))
    return HttpResponse.json(atualizado)
  }),
]
