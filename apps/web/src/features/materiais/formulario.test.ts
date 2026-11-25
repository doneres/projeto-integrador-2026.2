import { describe, expect, it } from 'vitest'
import { validarDadosComodato, validarDadosEncerramento, validarDadosMaterial } from './formulario'

describe('validarDadosMaterial', () => {
  it('retorna dados válidos quando os campos estão corretos', () => {
    const { dados, erros } = validarDadosMaterial({
      name: 'Geladeira Expositora',
      category: 'Geladeiras',
    })
    expect(erros).toEqual({})
    expect(dados).toEqual({
      name: 'Geladeira Expositora',
      category: 'Geladeiras',
    })
  })

  it('retorna erro se o nome estiver em branco', () => {
    const { dados, erros } = validarDadosMaterial({
      name: '   ',
      category: 'Geladeiras',
    })
    expect(dados).toBeUndefined()
    expect(erros.name).toBeDefined()
  })

  it('retorna erro se a categoria estiver em branco', () => {
    const { dados, erros } = validarDadosMaterial({
      name: 'Geladeira Expositora',
      category: '',
    })
    expect(dados).toBeUndefined()
    expect(erros.category).toBeDefined()
  })
})

describe('validarDadosComodato', () => {
  const payloadValido = {
    materialId: '0192f4a0-0000-7000-8000-000000000f01',
    customerId: '0192f4a0-0000-7000-8000-000000000001',
    serialNumber: 'GEL-0012',
    installedAt: '2026-10-15',
  }

  it('retorna dados válidos', () => {
    const { dados, erros } = validarDadosComodato(payloadValido)
    expect(erros).toEqual({})
    expect(dados).toEqual(payloadValido)
  })

  it('retorna erro se serialNumber for vazio', () => {
    const { dados, erros } = validarDadosComodato({
      ...payloadValido,
      serialNumber: '  ',
    })
    expect(dados).toBeUndefined()
    expect(erros.serialNumber).toBeDefined()
  })

  it('retorna erro se data de instalação for inválida', () => {
    const { dados, erros } = validarDadosComodato({
      ...payloadValido,
      installedAt: '15/10/2026',
    })
    expect(dados).toBeUndefined()
    expect(erros.installedAt).toBeDefined()
  })
})

describe('validarDadosEncerramento', () => {
  it('aceita data de encerramento igual ou posterior à instalação', () => {
    const { dados, erros } = validarDadosEncerramento({
      installedAt: '2026-10-15',
      endedAt: '2026-10-20',
    })
    expect(erros).toEqual({})
    expect(dados).toEqual({ endedAt: '2026-10-20' })
  })

  it('recusa data de encerramento anterior à data de instalação', () => {
    const { dados, erros } = validarDadosEncerramento({
      installedAt: '2026-10-15',
      endedAt: '2026-10-10',
    })
    expect(dados).toBeUndefined()
    expect(erros.endedAt).toContain('anterior')
  })
})
