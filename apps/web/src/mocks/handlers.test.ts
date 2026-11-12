import {
  customerSchema,
  dashboardSummarySchema,
  pageOf,
  problemaSchema,
  productSchema,
  routeDetailSchema,
  routeSchema,
  sessionSchema,
  userSchema,
} from '@axis/contracts'
import { setupServer } from 'msw/node'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { ZodType } from 'zod'
import { hojeEmSaoPaulo } from '../lib/datas'
import { clientesMock, rotasMock, SENHA_DEMO } from './data'
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
  document: '52998224725',
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
    expect(lista.corpo.total).toBe(8)

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

  it('recusa CPF/CNPJ repetido com 409 DOCUMENTO_JA_CADASTRADO', async () => {
    const headers = await entrar('gestor@axis.example')
    const { status, corpo } = await chamar(problemaSchema, '/v1/customers', {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...novoCliente, document: clientesMock[0].document }),
    })
    expect(status).toBe(409)
    expect(corpo.codigo).toBe('DOCUMENTO_JA_CADASTRADO')
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

  it('aprova prospecção pendente e rejeita com motivo (RF09, RN04)', async () => {
    const coordHeaders = await entrar('gestor@axis.example')
    const vendedorHeaders = await entrar('vendedor@axis.example')

    // Lista pendentes
    const pendentes = await chamar(
      pageOf(customerSchema),
      '/v1/customers?origin=prospect&status=pending_approval',
      { headers: coordHeaders },
    )
    expect(pendentes.corpo.total).toBe(2)
    const [primeiroPendente, segundoPendente] = pendentes.corpo.items

    // Vendedor não pode aprovar
    const negado = await chamar(problemaSchema, `/v1/customers/${primeiroPendente.id}/approval`, {
      method: 'POST',
      headers: vendedorHeaders,
    })
    expect(negado.status).toBe(403)

    // Coordenador aprova o primeiro
    const aprovado = await chamar(customerSchema, `/v1/customers/${primeiroPendente.id}/approval`, {
      method: 'POST',
      headers: coordHeaders,
    })
    expect(aprovado.status).toBe(200)
    expect(aprovado.corpo.status).toBe('active')
    expect(aprovado.corpo.approvedById).not.toBeNull()
    expect(aprovado.corpo.approvedAt).not.toBeNull()

    // Não pode aprovar de novo (409)
    const repetido = await chamar(problemaSchema, `/v1/customers/${primeiroPendente.id}/approval`, {
      method: 'POST',
      headers: coordHeaders,
    })
    expect(repetido.status).toBe(409)

    // Rejeição exige motivo não vazio (422)
    const semMotivo = await chamar(
      problemaSchema,
      `/v1/customers/${segundoPendente.id}/rejection`,
      {
        method: 'POST',
        headers: coordHeaders,
        body: JSON.stringify({ reason: '   ' }),
      },
    )
    expect(semMotivo.status).toBe(422)

    // Coordenador rejeita com motivo válido
    const rejeitado = await chamar(
      customerSchema,
      `/v1/customers/${segundoPendente.id}/rejection`,
      {
        method: 'POST',
        headers: coordHeaders,
        body: JSON.stringify({ reason: 'Fora do raio de cobertura da equipe' }),
      },
    )
    expect(rejeitado.status).toBe(200)
    expect(rejeitado.corpo.status).toBe('rejected')
    expect(rejeitado.corpo.rejectionReason).toBe('Fora do raio de cobertura da equipe')
  })

  it('lista os vendedores da Equipe (#79)', async () => {
    const headers = await entrar('gestor@axis.example')
    const { corpo } = await chamar(pageOf(userSchema), '/v1/users?role=seller', { headers })
    expect(corpo.items.map((u) => u.role)).toEqual(['seller', 'seller'])
  })

  it('lista as rotas do dia e detalha com as Visitas na ordem', async () => {
    const headers = await entrar('gestor@axis.example')
    const lista = await chamar(pageOf(routeSchema), `/v1/routes?date=${hojeEmSaoPaulo()}`, {
      headers,
    })
    expect(lista.corpo.total).toBe(2)
    const { corpo } = await chamar(routeDetailSchema, `/v1/routes/${rotasMock[0].id}`, {
      headers,
    })
    expect(corpo.visits.map((v) => v.position)).toEqual([1, 2, 3, 4])
    expect(corpo.visits.map((v) => v.status)).toEqual([
      'completed',
      'in_progress',
      'not_performed',
      'pending',
    ])
  })

  it('monta a rota com as Visitas Pendentes na ordem enviada e recusa repetir o dia', async () => {
    const headers = await entrar('gestor@axis.example')
    const vendedor = '0192f4a0-0000-7000-8000-0000000000a3'
    const corpo = {
      sellerId: vendedor,
      date: '2099-01-02',
      customerIds: [clientesMock[3].id, clientesMock[0].id],
    }
    const criada = await chamar(routeDetailSchema, '/v1/routes', {
      method: 'POST',
      headers,
      body: JSON.stringify(corpo),
    })
    expect(criada.status).toBe(201)
    expect(criada.corpo.visits.map((v) => [v.customerId, v.position, v.status])).toEqual([
      [clientesMock[3].id, 1, 'pending'],
      [clientesMock[0].id, 2, 'pending'],
    ])

    const repetida = await chamar(problemaSchema, '/v1/routes', {
      method: 'POST',
      headers,
      body: JSON.stringify(corpo),
    })
    expect(repetida.corpo.codigo).toBe('ROTA_JA_EXISTE')
  })

  it('não põe cliente inativo na rota', async () => {
    const headers = await entrar('gestor@axis.example')
    const inativo = clientesMock.find((c) => c.status === 'inactive')
    const { status, corpo } = await chamar(problemaSchema, '/v1/routes', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sellerId: '0192f4a0-0000-7000-8000-0000000000a2',
        date: '2099-01-03',
        customerIds: [inativo?.id],
      }),
    })
    expect(status).toBe(422)
    expect(corpo.erros?.[0]?.campo).toBe('customerIds')
  })

  it('resume o dashboard por perfil: Coordenador vê a Equipe e Diretor vê todas (#40)', async () => {
    const coordenadora = await entrar('gestor@axis.example')
    const painelCoord = await chamar(
      dashboardSummarySchema,
      `/v1/dashboard?date=${hojeEmSaoPaulo()}`,
      { headers: coordenadora },
    )
    expect(painelCoord.corpo.visitsBySeller.map((v) => v.sellerName)).toEqual([
      'Bruno Exemplo',
      'Diego Exemplo',
    ])
    expect(painelCoord.corpo.visits).toEqual({
      planned: 6,
      completed: 1,
      inProgress: 1,
      notPerformed: 1,
      pending: 3,
    })
    expect(painelCoord.corpo.ordersCount).toBeGreaterThanOrEqual(1)
    expect(painelCoord.corpo.revenueCents).toBeGreaterThanOrEqual(64500)

    const diretora = await entrar('diretor@axis.example')
    const painelDir = await chamar(
      dashboardSummarySchema,
      `/v1/dashboard?date=${hojeEmSaoPaulo()}`,
      { headers: diretora },
    )
    expect(painelDir.corpo.visitsBySeller.map((v) => v.sellerName)).toEqual([
      'Bruno Exemplo',
      'Diego Exemplo',
      'Lia Modelo',
    ])
    expect(painelDir.corpo.visits.planned).toBe(7)
    expect(painelDir.corpo.visits.completed).toBe(2)

    const admin = await entrar('administrador@axis.example')
    const negado = await chamar(problemaSchema, '/v1/dashboard', { headers: admin })
    expect(negado.status).toBe(403)
  })

  it('lista, busca, cadastra, edita e inativa produtos do catálogo (RF20, #44)', async () => {
    const adminHeaders = await entrar('administrador@axis.example')
    const coordHeaders = await entrar('gestor@axis.example')

    // Listagem geral de produtos
    const lista = await chamar(pageOf(productSchema), '/v1/products', { headers: adminHeaders })
    expect(lista.corpo.total).toBe(8)

    // Filtro por categoria
    const cervejas = await chamar(pageOf(productSchema), '/v1/products?category=Cervejas', {
      headers: coordHeaders,
    })
    expect(cervejas.corpo.total).toBe(2)

    // Busca por termo (nome ou SKU)
    const busca = await chamar(pageOf(productSchema), '/v1/products?search=cola', {
      headers: coordHeaders,
    })
    expect(busca.corpo.total).toBe(1)
    expect(busca.corpo.items[0].sku).toBe('REFR-COL-2000')

    // Coordenador não pode cadastrar produto (apenas Administrador)
    const negado = await chamar(problemaSchema, '/v1/products', {
      method: 'POST',
      headers: coordHeaders,
      body: JSON.stringify({
        sku: 'SUCO-LAR-1000',
        name: 'Suco de Laranja 1L',
        category: 'Sucos',
        unitPriceCents: 950,
        referenceStock: 100,
      }),
    })
    expect(negado.status).toBe(403)

    // Administrador cadastra novo produto
    const novoProduto = {
      sku: 'SUCO-LAR-1000',
      name: 'Suco de Laranja 1L',
      category: 'Sucos',
      unitPriceCents: 950,
      referenceStock: 100,
    }
    const criado = await chamar(productSchema, '/v1/products', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(novoProduto),
    })
    expect(criado.status).toBe(201)
    expect(criado.corpo.sku).toBe('SUCO-LAR-1000')
    expect(criado.corpo.active).toBe(true)

    // Recusa SKU duplicado (409)
    const duplicado = await chamar(problemaSchema, '/v1/products', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(novoProduto),
    })
    expect(duplicado.status).toBe(409)
    expect(duplicado.corpo.codigo).toBe('SKU_JA_CADASTRADO')

    // Administrador edita produto
    const editado = await chamar(productSchema, `/v1/products/${criado.corpo.id}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        ...novoProduto,
        name: 'Suco de Laranja Integral 1L',
        unitPriceCents: 990,
      }),
    })
    expect(editado.status).toBe(200)
    expect(editado.corpo.name).toBe('Suco de Laranja Integral 1L')
    expect(editado.corpo.unitPriceCents).toBe(990)

    // Administrador inativa produto
    const inativado = await chamar(productSchema, `/v1/products/${criado.corpo.id}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ active: false }),
    })
    expect(inativado.status).toBe(200)
    expect(inativado.corpo.active).toBe(false)

    // Reativa produto
    const reativado = await chamar(productSchema, `/v1/products/${criado.corpo.id}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ active: true }),
    })
    expect(reativado.status).toBe(200)
    expect(reativado.corpo.active).toBe(true)
  })
})
