import { customerSchema, pageOf, problemaSchema, sessionSchema } from '@axis/contracts'
import { setupServer } from 'msw/node'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { ZodType } from 'zod'
import { clientesMock, SENHA_DEMO } from './data'
import { handlers } from './handlers'

// A API simulada só ajuda se responder como a real: cada resposta passa pelo schema do contrato.
// Se um handler divergir do @axis/contracts, este teste falha.

const BASE = 'http://localhost'
const server = setupServer(...handlers)

beforeAll(() => {
  // Os handlers usam caminhos relativos (/v1/...), como no navegador. No Node não há `location`,
  // então damos uma origem para o MSW resolver esses caminhos.
  vi.stubGlobal('location', new URL(`${BASE}/`))
  server.listen()
})
afterAll(() => {
  server.close()
  vi.unstubAllGlobals()
})

async function chamar<T>(schema: ZodType<T>, caminho: string, init: RequestInit = {}) {
  const resposta = await fetch(`${BASE}${caminho}`, init)
  const resultado = schema.safeParse(await resposta.json())
  if (!resultado.success) {
    throw new Error(`${caminho} fora do contrato: ${resultado.error.message}`)
  }
  return { status: resposta.status, corpo: resultado.data }
}

async function entrar(identifier: string) {
  const { corpo } = await chamar(sessionSchema, '/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password: SENHA_DEMO }),
  })
  return { Authorization: `Bearer ${corpo.token}` }
}

const novoCliente = {
  legalName: 'Empório Teste Ltda',
  tradeName: 'Empório Teste',
  document: '11222333000181',
  phone: '62999990009',
  contactName: 'Rita',
  zipCode: '74000000',
  street: 'Rua Nova',
  number: '9',
  district: 'Setor Oeste',
  city: 'Goiânia',
  state: 'GO',
  latitude: -16.68,
  longitude: -49.26,
}

describe('API simulada segue o contrato', () => {
  it('login devolve a sessão; senha errada devolve Problem Details', async () => {
    await entrar('gestor@axis.example')
    const { status } = await chamar(problemaSchema, '/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'gestor@axis.example', password: 'errada' }),
    })
    expect(status).toBe(401)
  })

  it('lista, detalha, cadastra, edita e inativa clientes', async () => {
    const headers = await entrar('gestor@axis.example')

    const lista = await chamar(pageOf(customerSchema), '/v1/customers?page=1&perPage=10', {
      headers,
    })
    expect(lista.corpo.total).toBe(clientesMock.length)

    const primeiro = clientesMock[0]
    await chamar(customerSchema, `/v1/customers/${primeiro.id}`, { headers })

    const criado = await chamar(customerSchema, '/v1/customers', {
      method: 'POST',
      headers,
      body: JSON.stringify(novoCliente),
    })
    expect(criado.status).toBe(201)
    expect(criado.corpo).toMatchObject({ origin: 'portfolio', status: 'active' })

    const editado = await chamar(customerSchema, `/v1/customers/${criado.corpo.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ ...novoCliente, complement: 'Sala 2' }),
    })
    expect(editado.corpo.complement).toBe('Sala 2')

    const inativado = await chamar(customerSchema, `/v1/customers/${criado.corpo.id}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'inactive' }),
    })
    expect(inativado.corpo.status).toBe('inactive')
  })

  it('recusa CPF/CNPJ repetido com Problem Details apontando o campo', async () => {
    const headers = await entrar('gestor@axis.example')
    const { status, corpo } = await chamar(problemaSchema, '/v1/customers', {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...novoCliente, document: clientesMock[0].document }),
    })
    expect(status).toBe(409)
    expect(corpo.erros?.[0]?.campo).toBe('document')
  })

  it('só o Coordenador cadastra cliente', async () => {
    const headers = await entrar('vendedor@axis.example')
    const { status } = await chamar(problemaSchema, '/v1/customers', {
      method: 'POST',
      headers,
      body: JSON.stringify(novoCliente),
    })
    expect(status).toBe(403)
  })
})
