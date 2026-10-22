import { type Sessao, sessaoSchema } from '@axis/contracts'
import { useSyncExternalStore } from 'react'

const CHAVE = 'axis.sessao'

type Ouvinte = () => void
const ouvintes = new Set<Ouvinte>()

function armazenamento(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function lerDoArmazenamento(): Sessao | null {
  try {
    const bruto = armazenamento()?.getItem(CHAVE)
    if (!bruto) {
      return null
    }
    const resultado = sessaoSchema.safeParse(JSON.parse(bruto))
    return resultado.success ? resultado.data : null
  } catch {
    return null
  }
}

function gravar(valor: string | null): void {
  try {
    const destino = armazenamento()
    if (valor === null) {
      destino?.removeItem(CHAVE)
    } else {
      destino?.setItem(CHAVE, valor)
    }
  } catch {
    // Sem armazenamento disponível (ex.: navegação privada): a sessão fica só na memória.
  }
}

let atual: Sessao | null = lerDoArmazenamento()
let encerradaPeloUsuario = false

function notificar(): void {
  for (const ouvinte of ouvintes) {
    ouvinte()
  }
}

export function obterSessao(): Sessao | null {
  return atual
}

/** A sessão vale até o instante `expiraEm` definido pela API no login. */
export function sessaoValida(sessao: Sessao | null, agora = Date.now()): sessao is Sessao {
  return sessao !== null && Date.parse(sessao.expiraEm) > agora
}

export function iniciarSessao(sessao: Sessao): void {
  atual = sessao
  encerradaPeloUsuario = false
  gravar(JSON.stringify(sessao))
  notificar()
}

/**
 * RF04: encerra a sessão apagando o token guardado no navegador.
 * O motivo diz se foi o usuário que saiu ou se a sessão expirou (ex.: 401 da API).
 */
export function encerrarSessao(motivo: 'saida' | 'expiracao' = 'expiracao'): void {
  encerradaPeloUsuario = motivo === 'saida'
  gravar(null)
  if (atual !== null) {
    atual = null
    notificar()
  }
}

/** Se a última sessão terminou porque o usuário clicou em Sair. */
export function sessaoEncerradaPeloUsuario(): boolean {
  return encerradaPeloUsuario
}

export function assinarSessao(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

/** Sessão atual, atualizada em todos os componentes quando alguém entra ou sai. */
export function useSessao(): Sessao | null {
  return useSyncExternalStore(assinarSessao, obterSessao, () => null)
}
