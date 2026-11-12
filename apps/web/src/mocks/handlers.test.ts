import {
  customerSchema,
  dashboardSummarySchema,
  loanDetailSchema,
  pageOf,
  posMaterialSchema,
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

  it('permite listar, cadastrar, editar, inativar e excluir materiais de PDV com regra de comodato ativo (#42)', async () => {
    const adminHeaders = await entrar('administrador@axis.example')
    const gestorHeaders = await entrar('gestor@axis.example')

    // Listagem pública para autenticados
    const listagem = await chamar(pageOf(posMaterialSchema), '/v1/pos-materials', {
      headers: gestorHeaders,
    })
    expect(listagem.status).toBe(200)
    expect(listagem.corpo.items.length).toBeGreaterThanOrEqual(1)

    // Coordenador não pode cadastrar material (403)
    const negado = await chamar(problemaSchema, '/v1/pos-materials', {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify({
        name: 'Geladeira Comercial 450L',
        category: 'Geladeiras',
      }),
    })
    expect(negado.status).toBe(403)

    // Administrador cadastra novo material
    const novoMaterial = {
      name: 'Geladeira Comercial 450L',
      category: 'Geladeiras',
    }
    const criado = await chamar(posMaterialSchema, '/v1/pos-materials', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(novoMaterial),
    })
    expect(criado.status).toBe(201)
    expect(criado.corpo.name).toBe('Geladeira Comercial 450L')
    expect(criado.corpo.active).toBe(true)

    // Administrador edita material
    const editado = await chamar(posMaterialSchema, `/v1/pos-materials/${criado.corpo.id}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'Geladeira Comercial Frost Free 450L',
        category: 'Geladeiras Especiais',
      }),
    })
    expect(editado.status).toBe(200)
    expect(editado.corpo.name).toBe('Geladeira Comercial Frost Free 450L')

    // Administrador inativa material
    const inativado = await chamar(
      posMaterialSchema,
      `/v1/pos-materials/${criado.corpo.id}/status`,
      {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ active: false }),
      },
    )
    expect(inativado.status).toBe(200)
    expect(inativado.corpo.active).toBe(false)

    // Bloqueio de exclusão quando há comodato ativo vinculado (409 MATERIAL_EM_USO)
    // O material 0192f4a0-0000-7000-8000-000000000f01 tem o comodato ativo 0192f4a0-0000-7000-8000-000000000c01
    const bloqueado = await chamar(
      problemaSchema,
      '/v1/pos-materials/0192f4a0-0000-7000-8000-000000000f01',
      {
        method: 'DELETE',
        headers: adminHeaders,
      },
    )
    expect(bloqueado.status).toBe(409)
    expect(bloqueado.corpo.codigo).toBe('MATERIAL_EM_USO')

    // Exclusão permitida para material sem comodatos ativos (204)
    const respostaDelete = await fetch(`${BASE}/v1/pos-materials/${criado.corpo.id}`, {
      method: 'DELETE',
      headers: adminHeaders,
    })
    expect(respostaDelete.status).toBe(204)
  })

  it('controla comodatos por cliente com escopo por perfil e encerramento sem exclusão física (#42)', async () => {
    const adminHeaders = await entrar('administrador@axis.example')
    const gestorHeaders = await entrar('gestor@axis.example')

    // Coordenador lista comodatos (apenas da sua equipe)
    const listaGestor = await chamar(pageOf(loanDetailSchema), '/v1/loans', {
      headers: gestorHeaders,
    })
    expect(listaGestor.status).toBe(200)
    // Nenhum comodato da lista do gestor pertence ao cliente de outro coordenador
    expect(
      listaGestor.corpo.items.some((l) => l.customerId === '0192f4a0-0000-7000-8000-000000000006'),
    ).toBe(false)

    // Administrador lista todos os comodatos
    const listaAdmin = await chamar(pageOf(loanDetailSchema), '/v1/loans', {
      headers: adminHeaders,
    })
    expect(listaAdmin.status).toBe(200)
    expect(
      listaAdmin.corpo.items.some((l) => l.customerId === '0192f4a0-0000-7000-8000-000000000006'),
    ).toBe(true)

    // Coordenador não pode cadastrar comodato (403)
    const novoComodato = {
      materialId: '0192f4a0-0000-7000-8000-000000000f03',
      customerId: '0192f4a0-0000-7000-8000-000000000001',
      serialNumber: 'SN-TEST-8899',
      installedAt: '2026-11-01',
    }
    const negadoCriacao = await chamar(problemaSchema, '/v1/loans', {
      method: 'POST',
      headers: gestorHeaders,
      body: JSON.stringify(novoComodato),
    })
    expect(negadoCriacao.status).toBe(403)

    // Administrador cadastra novo comodato
    const criado = await chamar(loanDetailSchema, '/v1/loans', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(novoComodato),
    })
    expect(criado.status).toBe(201)
    expect(criado.corpo.serialNumber).toBe('SN-TEST-8899')
    expect(criado.corpo.endedAt).toBeNull()

    // Recusa mesmo patrimônio ativo (409)
    const duplicado = await chamar(problemaSchema, '/v1/loans', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(novoComodato),
    })
    expect(duplicado.status).toBe(409)
    expect(duplicado.corpo.codigo).toBe('NUMERO_SERIE_EM_USO')

    // Coordenador não pode encerrar comodato (403)
    const negadoEncerramento = await chamar(problemaSchema, `/v1/loans/${criado.corpo.id}/end`, {
      method: 'PATCH',
      headers: gestorHeaders,
      body: JSON.stringify({ endedAt: '2026-11-10' }),
    })
    expect(negadoEncerramento.status).toBe(403)

    // Recusa data de encerramento anterior à data de instalação (422)
    const dataInvalida = await chamar(problemaSchema, `/v1/loans/${criado.corpo.id}/end`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ endedAt: '2026-10-01' }),
    })
    expect(dataInvalida.status).toBe(422)

    // Administrador encerra comodato
    const encerrado = await chamar(loanDetailSchema, `/v1/loans/${criado.corpo.id}/end`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ endedAt: '2026-11-10' }),
    })
    expect(encerrado.status).toBe(200)
    expect(encerrado.corpo.endedAt).toBe('2026-11-10')

    // Tentar encerrar novamente recusa com 409 TRANSICAO_INVALIDA
    const reencerrado = await chamar(problemaSchema, `/v1/loans/${criado.corpo.id}/end`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ endedAt: '2026-11-11' }),
    })
    expect(reencerrado.status).toBe(409)
    expect(reencerrado.corpo.codigo).toBe('TRANSICAO_INVALIDA')
  })
})
