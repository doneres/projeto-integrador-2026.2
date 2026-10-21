import { type Cliente, errosDeValidacao, type Pagina, paginacaoSchema } from '@axis/contracts'
import { delay, HttpResponse, http } from 'msw'
import { clientesMock } from './data'

// Cada handler imita um endpoint do contrato da API (/v1/...).
export const handlers = [
  http.get('/v1/clientes', async ({ request }) => {
    await delay(300)
    const parametros = Object.fromEntries(new URL(request.url).searchParams)
    const consulta = paginacaoSchema.safeParse(parametros)
    if (!consulta.success) {
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Parâmetros inválidos',
          status: 422,
          codigo: 'VALIDACAO',
          erros: errosDeValidacao(consulta.error),
        },
        { status: 422, headers: { 'Content-Type': 'application/problem+json' } },
      )
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
