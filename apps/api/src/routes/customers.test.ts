import type { Customer, Page, Problema } from '@axis/contracts'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TEST_JWT_SECRET } from '../../test/support/config'
import { createTestDatabase, type TestDatabase } from '../../test/support/database'
import { cnpjNumber, insertCustomer, insertRoute } from '../../test/support/factories'
import { bearer, createWorld } from '../../test/support/world'
import { buildApp } from '../app'

let testDb: TestDatabase
let app: Awaited<ReturnType<typeof buildApp>>
let world: Awaited<ReturnType<typeof createWorld>>

type Row = Awaited<ReturnType<typeof insertCustomer>>
let padaria: Row // Equipe A, na rota do vendedor A1
let mercado: Row // Equipe A, na rota do vendedor A1
let bar: Row // Equipe A, fora de qualquer rota
let kiosk: Row // Equipe A, na rota do vendedor A2
let prospect: Row // Equipe A, prospecção do vendedor A1 ainda pendente
let inactive: Row // Equipe A, inativo
let outra: Row // Equipe B

beforeAll(async () => {
  testDb = await createTestDatabase()
  app = await buildApp({ db: testDb.db, auth: { jwtSecret: TEST_JWT_SECRET } })
  world = await createWorld(testDb.db)
  const a = world.coordinatorA.id

  padaria = await insertCustomer(testDb.db, {
    coordinatorId: a,
    tradeName: 'Padaria Central',
    legalName: 'Silva & Filhos Ltda',
    district: 'Setor Central',
    city: 'Goiânia',
    createdAt: new Date('2026-10-01T12:00:00Z'),
  })
  mercado = await insertCustomer(testDb.db, {
    coordinatorId: a,
    tradeName: 'Mercado Sul',
    legalName: 'Mercado do Sul Ltda',
    district: 'Setor Sul',
    city: 'Aparecida de Goiânia',
    createdAt: new Date('2026-10-02T12:00:00Z'),
  })
  bar = await insertCustomer(testDb.db, {
    coordinatorId: a,
    tradeName: 'Bar do Zé',
    legalName: 'José 100% Bebidas ME',
    district: 'Setor Sul',
    city: 'Goiânia',
    createdAt: new Date('2026-10-03T12:00:00Z'),
  })
  kiosk = await insertCustomer(testDb.db, { coordinatorId: a, tradeName: 'Kiosk da Praça' })
  prospect = await insertCustomer(testDb.db, {
    coordinatorId: a,
    createdById: world.sellerA1.id,
    tradeName: 'Prospecção Nova',
    origin: 'prospect',
    status: 'pending_approval',
  })
  inactive = await insertCustomer(testDb.db, {
    coordinatorId: a,
    tradeName: 'Antigo Armazém',
    status: 'inactive',
  })
  outra = await insertCustomer(testDb.db, {
    coordinatorId: world.coordinatorB.id,
    tradeName: 'Cliente da Equipe B',
  })

  await insertRoute(testDb.db, {
    sellerId: world.sellerA1.id,
    createdById: a,
    date: '2026-11-03',
    visits: [{ customerId: padaria.id }, { customerId: mercado.id }],
  })
  await insertRoute(testDb.db, {
    sellerId: world.sellerA2.id,
    createdById: a,
    date: '2026-11-03',
    visits: [{ customerId: kiosk.id }],
  })
  await app.ready()
})
afterAll(async () => {
  await app.close()
  await testDb.drop()
})

type Caller = { id: string } | undefined

async function call(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  user: Caller,
  payload?: unknown,
) {
  return app.inject({
    method,
    url,
    headers: user ? await bearer(user) : {},
    ...(payload === undefined ? {} : { payload: payload as object }),
  })
}

const list = (query: string, user: Caller) => call('GET', `/v1/customers${query}`, user)
const names = (response: { json: () => unknown }) =>
  (response.json() as Page<Customer>).items.map((customer) => customer.tradeName)

describe('GET /v1/customers: escopo por perfil', () => {
  it('exige login', async () => {
    expect((await list('', undefined)).statusCode).toBe(401)
  })

  it('o administrador recebe 403', async () => {
    const response = await list('', world.admin)
    expect(response.statusCode).toBe(403)
    expect((response.json() as Problema).codigo).toBe('SEM_PERMISSAO')
  })

  it('o vendedor vê os clientes das próprias rotas e as próprias prospecções, só', async () => {
    const response = await list('?perPage=100', world.sellerA1)

    expect(response.statusCode).toBe(200)
    expect(names(response).sort()).toEqual(['Mercado Sul', 'Padaria Central', 'Prospecção Nova'])
  })

  it('o vendedor não vê cliente da própria equipe que está só na rota de outro vendedor', async () => {
    expect(names(await list('?perPage=100', world.sellerA2))).toEqual(['Kiosk da Praça'])
  })

  it('o coordenador vê todos os clientes da sua equipe, e só eles', async () => {
    const a = names(await list('?perPage=100', world.coordinatorA))
    expect(a).toHaveLength(6)
    expect(a).not.toContain('Cliente da Equipe B')
    expect(names(await list('?perPage=100', world.coordinatorB))).toEqual(['Cliente da Equipe B'])
  })

  it('o diretor vê os clientes de todas as equipes', async () => {
    expect(((await list('', world.director)).json() as Page<Customer>).total).toBe(7)
  })
})

describe('GET /v1/customers: paginação, busca, filtro e ordenação', () => {
  it('pagina e informa o total', async () => {
    const first = (await list('?perPage=2&page=1', world.director)).json() as Page<Customer>
    const last = (await list('?perPage=2&page=4', world.director)).json() as Page<Customer>

    expect(first).toMatchObject({ total: 7, page: 1, perPage: 2 })
    expect(first.items).toHaveLength(2)
    expect(last.items).toHaveLength(1)
  })

  it('ordena por nome fantasia crescente por padrão', async () => {
    expect(names(await list('?perPage=100', world.coordinatorA))).toEqual([
      'Antigo Armazém',
      'Bar do Zé',
      'Kiosk da Praça',
      'Mercado Sul',
      'Padaria Central',
      'Prospecção Nova',
    ])
  })

  it('ordena no sentido e pelo campo pedidos', async () => {
    expect(names(await list('?sortBy=tradeName&order=desc&perPage=2', world.coordinatorA))).toEqual(
      ['Prospecção Nova', 'Padaria Central'],
    )
    expect(
      names(await list('?sortBy=createdAt&order=asc&perPage=3', world.coordinatorA)).slice(0, 3),
    ).toEqual(['Padaria Central', 'Mercado Sul', 'Bar do Zé'])
  })

  it('recusa ordenar por campo desconhecido', async () => {
    expect((await list('?sortBy=document', world.director)).statusCode).toBe(422)
  })

  it('busca no nome fantasia e na razão social, sem diferenciar maiúsculas nem exigir o texto inteiro', async () => {
    expect(names(await list('?search=padaria', world.coordinatorA))).toEqual(['Padaria Central'])
    expect(names(await list('?search=SILVA', world.coordinatorA))).toEqual(['Padaria Central'])
  })

  it('busca pelo CPF/CNPJ, com ou sem máscara', async () => {
    const digits = padaria.document
    const masked = `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
    expect(names(await list(`?search=${digits}`, world.coordinatorA))).toEqual(['Padaria Central'])
    expect(names(await list(`?search=${encodeURIComponent(masked)}`, world.coordinatorA))).toEqual([
      'Padaria Central',
    ])
  })

  it('trata % e _ da busca como texto comum, não como curinga', async () => {
    expect(names(await list(`?search=${encodeURIComponent('100%')}`, world.coordinatorA))).toEqual([
      'Bar do Zé',
    ])
    expect(names(await list(`?search=${encodeURIComponent('%')}`, world.coordinatorA))).toEqual([
      'Bar do Zé',
    ])
    expect(names(await list(`?search=${encodeURIComponent('_')}`, world.coordinatorA))).toEqual([])
  })

  it('a busca respeita o escopo: o vendedor não acha cliente fora das suas rotas', async () => {
    expect(names(await list('?search=Bar', world.sellerA1))).toEqual([])
  })

  it('filtra por status, origem e bairro', async () => {
    expect(names(await list('?status=inactive', world.coordinatorA))).toEqual(['Antigo Armazém'])
    expect(names(await list('?origin=prospect', world.coordinatorA))).toEqual(['Prospecção Nova'])
    expect(names(await list('?status=pending_approval', world.sellerA1))).toEqual([
      'Prospecção Nova',
    ])
    expect(
      names(await list(`?district=${encodeURIComponent('Setor Sul')}`, world.coordinatorA)),
    ).toEqual(['Bar do Zé', 'Mercado Sul'])
  })

  it('combina busca, filtro e paginação', async () => {
    const page = (
      await list(
        `?district=${encodeURIComponent('Setor Sul')}&search=bar&perPage=1`,
        world.coordinatorA,
      )
    ).json() as Page<Customer>
    expect(page.total).toBe(1)
    expect(page.items.map((c) => c.tradeName)).toEqual(['Bar do Zé'])
  })

  it('o cliente inativo continua na listagem (histórico), nunca é excluído', async () => {
    expect(names(await list('?perPage=100', world.coordinatorA))).toContain(inactive.tradeName)
  })
})

describe('GET /v1/customers/{id}', () => {
  it('devolve o cliente dentro do escopo e 404 fora dele', async () => {
    const own = await call('GET', `/v1/customers/${padaria.id}`, world.sellerA1)
    expect(own.statusCode).toBe(200)
    expect((own.json() as Customer).tradeName).toBe('Padaria Central')

    expect((await call('GET', `/v1/customers/${bar.id}`, world.sellerA1)).statusCode).toBe(404)
    expect((await call('GET', `/v1/customers/${outra.id}`, world.coordinatorA)).statusCode).toBe(
      404,
    )
    expect((await call('GET', `/v1/customers/${outra.id}`, world.director)).statusCode).toBe(200)
    expect((await call('GET', `/v1/customers/${padaria.id}`, world.admin)).statusCode).toBe(403)
  })

  it('o vendedor lê a própria prospecção pendente', async () => {
    expect((await call('GET', `/v1/customers/${prospect.id}`, world.sellerA1)).statusCode).toBe(200)
  })

  it('responde 404 para id inexistente e 422 para id que não é UUID', async () => {
    expect(
      (await call('GET', '/v1/customers/0192f4a0-0000-7000-8000-000000000000', world.director))
        .statusCode,
    ).toBe(404)
    expect((await call('GET', '/v1/customers/abc', world.director)).statusCode).toBe(422)
  })
})

const newCustomer = (document: string) => ({
  legalName: 'Empório Novo Ltda',
  tradeName: 'Empório Novo',
  document,
  phone: '62999990000',
  contactName: 'Joana',
  zipCode: '74000000',
  street: 'Rua das Flores',
  number: '10',
  district: 'Setor Oeste',
  city: 'Goiânia',
  state: 'GO',
  latitude: -16.68,
  longitude: -49.25,
})

describe('POST /v1/customers', () => {
  it('o coordenador cadastra um cliente de carteira, ativo e da sua equipe', async () => {
    const response = await call(
      'POST',
      '/v1/customers',
      world.coordinatorA,
      newCustomer(cnpjNumber(9001)),
    )

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({
      tradeName: 'Empório Novo',
      complement: null,
      origin: 'portfolio',
      status: 'active',
      coordinatorId: world.coordinatorA.id,
      createdById: world.coordinatorA.id,
      approvedById: null,
      approvedAt: null,
      rejectionReason: null,
    })
    const created = response.json() as Customer
    expect((await call('GET', `/v1/customers/${created.id}`, world.coordinatorA)).statusCode).toBe(
      200,
    )
    // O cliente é da Equipe A: a B não o enxerga.
    expect((await call('GET', `/v1/customers/${created.id}`, world.coordinatorB)).statusCode).toBe(
      404,
    )
  })

  it('exige as coordenadas', async () => {
    const { latitude: _latitude, ...withoutLatitude } = newCustomer(cnpjNumber(9002))
    const response = await call('POST', '/v1/customers', world.coordinatorA, withoutLatitude)

    expect(response.statusCode).toBe(422)
    expect((response.json() as Problema).erros?.map((e) => e.campo)).toContain('latitude')
  })

  it('recusa CNPJ com dígitos errados', async () => {
    const response = await call(
      'POST',
      '/v1/customers',
      world.coordinatorA,
      newCustomer('12345678000100'),
    )
    expect(response.statusCode).toBe(422)
  })

  it('recusa um documento que já é de outro cliente: 409 DOCUMENTO_JA_CADASTRADO', async () => {
    const response = await call(
      'POST',
      '/v1/customers',
      world.coordinatorB,
      newCustomer(padaria.document),
    )

    expect(response.statusCode).toBe(409)
    expect((response.json() as Problema).codigo).toBe('DOCUMENTO_JA_CADASTRADO')
  })

  it('aceita o documento de uma prospecção que foi rejeitada', async () => {
    const document = cnpjNumber(9003)
    await insertCustomer(testDb.db, {
      coordinatorId: world.coordinatorA.id,
      document,
      origin: 'prospect',
      status: 'rejected',
      rejectionReason: 'Duplicado',
    })

    expect(
      (await call('POST', '/v1/customers', world.coordinatorA, newCustomer(document))).statusCode,
    ).toBe(201)
  })

  it('só o coordenador cadastra: vendedor, diretor e administrador recebem 403', async () => {
    for (const user of [world.sellerA1, world.director, world.admin]) {
      const response = await call('POST', '/v1/customers', user, newCustomer(cnpjNumber(9004)))
      expect(response.statusCode).toBe(403)
    }
  })

  it('exige login', async () => {
    expect(
      (await call('POST', '/v1/customers', undefined, newCustomer(cnpjNumber(9005)))).statusCode,
    ).toBe(401)
  })
})

describe('PUT /v1/customers/{id}', () => {
  it('o coordenador edita um cliente da sua equipe sem mexer na origem, no estado nem no dono', async () => {
    const target = await insertCustomer(testDb.db, { coordinatorId: world.coordinatorA.id })
    const body = {
      ...newCustomer(target.document),
      tradeName: 'Nome Corrigido',
      complement: 'Sala 2',
      latitude: -16.7,
    }

    const response = await call('PUT', `/v1/customers/${target.id}`, world.coordinatorA, body)

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      id: target.id,
      tradeName: 'Nome Corrigido',
      complement: 'Sala 2',
      latitude: -16.7,
      origin: 'portfolio',
      status: 'active',
      coordinatorId: world.coordinatorA.id,
    })
  })

  it('não edita cliente de outra equipe (404), nem como vendedor ou diretor (403)', async () => {
    const body = newCustomer(outra.document)
    expect(
      (await call('PUT', `/v1/customers/${outra.id}`, world.coordinatorA, body)).statusCode,
    ).toBe(404)
    expect(
      (await call('PUT', `/v1/customers/${padaria.id}`, world.sellerA1, body)).statusCode,
    ).toBe(403)
    expect(
      (await call('PUT', `/v1/customers/${padaria.id}`, world.director, body)).statusCode,
    ).toBe(403)
  })

  it('recusa trocar o documento por o de outro cliente: 409', async () => {
    const target = await insertCustomer(testDb.db, { coordinatorId: world.coordinatorA.id })
    const response = await call(
      'PUT',
      `/v1/customers/${target.id}`,
      world.coordinatorA,
      newCustomer(padaria.document),
    )
    expect(response.statusCode).toBe(409)
    expect((response.json() as Problema).codigo).toBe('DOCUMENTO_JA_CADASTRADO')
  })

  it('exige as coordenadas também na edição', async () => {
    const { longitude: _longitude, ...body } = newCustomer(padaria.document)
    expect(
      (await call('PUT', `/v1/customers/${padaria.id}`, world.coordinatorA, body)).statusCode,
    ).toBe(422)
  })
})

describe('PATCH /v1/customers/{id}/status', () => {
  it('o coordenador inativa e reativa um cliente em vez de excluí-lo', async () => {
    const target = await insertCustomer(testDb.db, { coordinatorId: world.coordinatorA.id })
    const url = `/v1/customers/${target.id}/status`

    const off = await call('PATCH', url, world.coordinatorA, { status: 'inactive' })
    expect(off.statusCode).toBe(200)
    expect((off.json() as Customer).status).toBe('inactive')

    const on = await call('PATCH', url, world.coordinatorA, { status: 'active' })
    expect((on.json() as Customer).status).toBe('active')
  })

  it('não existe exclusão de cliente', async () => {
    expect(
      (await call('DELETE', `/v1/customers/${padaria.id}`, world.coordinatorA)).statusCode,
    ).toBe(404)
  })

  it('prospecção pendente não muda por aqui: 409 TRANSICAO_INVALIDA', async () => {
    const response = await call(
      'PATCH',
      `/v1/customers/${prospect.id}/status`,
      world.coordinatorA,
      {
        status: 'inactive',
      },
    )
    expect(response.statusCode).toBe(409)
    expect((response.json() as Problema).codigo).toBe('TRANSICAO_INVALIDA')
  })

  it('só o coordenador da equipe: outra equipe 404, vendedor 403', async () => {
    const body = { status: 'inactive' }
    expect(
      (await call('PATCH', `/v1/customers/${outra.id}/status`, world.coordinatorA, body))
        .statusCode,
    ).toBe(404)
    expect(
      (await call('PATCH', `/v1/customers/${padaria.id}/status`, world.sellerA1, body)).statusCode,
    ).toBe(403)
  })

  it('recusa estado que não seja active ou inactive', async () => {
    const response = await call('PATCH', `/v1/customers/${padaria.id}/status`, world.coordinatorA, {
      status: 'rejected',
    })
    expect(response.statusCode).toBe(422)
  })
})
