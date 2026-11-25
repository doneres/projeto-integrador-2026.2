import type { Session } from '@axis/contracts'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assinarSessao,
  encerrarSessao,
  iniciarSessao,
  obterSessao,
  sessaoEncerradaPeloUsuario,
  sessaoValida,
} from './sessao'

const sessao: Session = {
  token: 'token',
  expiresAt: '2026-10-21T11:00:00Z',
  user: {
    id: '0192f4a0-0000-7000-8000-0000000000a1',
    name: 'Maria Souza',
    email: 'gestor@axis.example',
    registration: '1001',
    role: 'coordinator',
    coordinatorId: null,
    active: true,
  },
}

afterEach(() => {
  encerrarSessao()
})

describe('sessão', () => {
  it('guarda a sessão iniciada e avisa quem acompanha', () => {
    const ouvinte = vi.fn()
    const cancelar = assinarSessao(ouvinte)
    iniciarSessao(sessao)
    expect(obterSessao()).toEqual(sessao)
    expect(ouvinte).toHaveBeenCalledTimes(1)
    cancelar()
  })

  it('encerra a sessão no logout (RF04)', () => {
    iniciarSessao(sessao)
    encerrarSessao()
    expect(obterSessao()).toBeNull()
  })

  it('lembra se a sessão terminou por um Sair ou por expiração', () => {
    iniciarSessao(sessao)
    encerrarSessao('saida')
    expect(sessaoEncerradaPeloUsuario()).toBe(true)
    iniciarSessao(sessao)
    encerrarSessao()
    expect(sessaoEncerradaPeloUsuario()).toBe(false)
  })

  it('considera a sessão válida só até expiresAt', () => {
    expect(sessaoValida(sessao, Date.parse('2026-10-21T10:59:59Z'))).toBe(true)
    expect(sessaoValida(sessao, Date.parse('2026-10-21T11:00:00Z'))).toBe(false)
    expect(sessaoValida(null)).toBe(false)
  })
})
