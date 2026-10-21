import {
  type Cliente,
  type ErroDeCampo,
  errosDeValidacao,
  loginSchema,
  type Pagina,
  paginacaoSchema,
  type Sessao,
  type Usuario,
} from '@axis/contracts'
import { delay, HttpResponse, http } from 'msw'
import { clientesMock, SENHA_DEMO, usuariosMock } from './data'

const DURACAO_DA_SESSAO_MS = 8 * 60 * 60 * 1000
const PREFIXO_DO_TOKEN = 'Bearer token-simulado-'

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

// Cada handler imita um endpoint do contrato da API (/v1/...).
export const handlers = [
  http.post('/v1/auth/login', async ({ request }) => {
    await delay(400)
    const corpo = loginSchema.safeParse(await request.json().catch(() => undefined))
    if (!corpo.success) {
      return problema(422, 'VALIDACAO', 'Dados inválidos', {
        erros: errosDeValidacao(corpo.error),
      })
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
    const parametros = Object.fromEntries(new URL(request.url).searchParams)
    const consulta = paginacaoSchema.safeParse(parametros)
    if (!consulta.success) {
      return problema(422, 'VALIDACAO', 'Parâmetros inválidos', {
        erros: errosDeValidacao(consulta.error),
      })
    }

    const { pagina, porPagina } = consulta.data
    const inicio = (pagina - 1) * porPagina
    const corpo: Pagina<Cliente> = {
      itens: clientesMock.slice(inicio, inicio + porPagina),
      total: clientesMock.length,
      pagina,
      porPagina,
    }
    return HttpResponse.json(corpo)
  }),
]
