import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  centavosSchema,
  dataCalendarioSchema,
  errosDeValidacao,
  idSchema,
  instanteSchema,
  paginacaoSchema,
  paginaDe,
  problemaSchema,
} from './comum'

describe('idSchema', () => {
  it('aceita UUID v7', () => {
    expect(idSchema.safeParse('0192f4a0-7c1e-7d2a-9b3c-4d5e6f708192').success).toBe(true)
  })

  it('recusa id numérico', () => {
    expect(idSchema.safeParse('42').success).toBe(false)
  })
})

describe('instanteSchema', () => {
  it('aceita ISO 8601 em UTC', () => {
    expect(instanteSchema.safeParse('2026-11-06T13:00:00Z').success).toBe(true)
  })

  it('recusa horário com deslocamento de fuso', () => {
    expect(instanteSchema.safeParse('2026-11-06T10:00:00-03:00').success).toBe(false)
  })
})

describe('dataCalendarioSchema', () => {
  it('aceita AAAA-MM-DD', () => {
    expect(dataCalendarioSchema.safeParse('2026-11-06').success).toBe(true)
  })

  it('recusa o formato com barras', () => {
    expect(dataCalendarioSchema.safeParse('06/11/2026').success).toBe(false)
  })
})

describe('centavosSchema', () => {
  it('aceita valor inteiro', () => {
    expect(centavosSchema.safeParse(1234).success).toBe(true)
  })

  it('recusa fração de centavo', () => {
    expect(centavosSchema.safeParse(12.5).success).toBe(false)
  })

  it('recusa valor negativo', () => {
    expect(centavosSchema.safeParse(-1).success).toBe(false)
  })
})

describe('paginacaoSchema', () => {
  it('usa a página 1 com 20 itens por padrão', () => {
    expect(paginacaoSchema.parse({})).toEqual({ pagina: 1, porPagina: 20 })
  })

  it('converte os valores que chegam como texto na query string', () => {
    expect(paginacaoSchema.parse({ pagina: '3', porPagina: '50' })).toEqual({
      pagina: 3,
      porPagina: 50,
    })
  })

  it('recusa mais de 100 itens por página', () => {
    expect(paginacaoSchema.safeParse({ porPagina: '500' }).success).toBe(false)
  })
})

describe('paginaDe', () => {
  const paginaDeNomes = paginaDe(z.object({ nome: z.string() }))

  it('aceita uma página com itens válidos', () => {
    const pagina = { itens: [{ nome: 'A' }], total: 1, pagina: 1, porPagina: 20 }
    expect(paginaDeNomes.safeParse(pagina).success).toBe(true)
  })

  it('valida cada item com o schema informado', () => {
    const pagina = { itens: [{ nome: 1 }], total: 1, pagina: 1, porPagina: 20 }
    expect(paginaDeNomes.safeParse(pagina).success).toBe(false)
  })
})

describe('problemaSchema', () => {
  it('aceita um Problem Details com código e erros de campo', () => {
    const problema = {
      type: 'about:blank',
      title: 'Dados inválidos',
      status: 422,
      codigo: 'VALIDACAO',
      erros: [{ campo: 'endereco.cep', mensagem: 'O CEP deve ter 8 dígitos' }],
    }
    expect(problemaSchema.safeParse(problema).success).toBe(true)
  })

  it('usa about:blank quando o type não vem', () => {
    const problema = problemaSchema.parse({
      title: 'Não encontrado',
      status: 404,
      codigo: 'NAO_ENCONTRADO',
    })
    expect(problema.type).toBe('about:blank')
  })

  it('exige o código do erro', () => {
    expect(problemaSchema.safeParse({ title: 'Erro', status: 500 }).success).toBe(false)
  })
})

describe('errosDeValidacao', () => {
  it('converte os problemas do Zod em campo e mensagem', () => {
    const schema = z.object({ endereco: z.object({ cep: z.string().min(8, 'CEP curto') }) })
    const { error } = schema.safeParse({ endereco: { cep: '123' } })
    if (!error) {
      throw new Error('Era esperado um erro de validação')
    }
    expect(errosDeValidacao(error)).toEqual([{ campo: 'endereco.cep', mensagem: 'CEP curto' }])
  })
})
