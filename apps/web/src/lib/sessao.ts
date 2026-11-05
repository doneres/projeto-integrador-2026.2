import { type Session, sessionSchema } from '@axis/contracts'
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

function lerDoArmazenamento(): Session | null {
  try {
    const bruto = armazenamento()?.getItem(CHAVE)
    if (!bruto) {
      return null
    }
    // Uma sessão gravada no formato antigo (contrato em português) não passa no schema e vira
    // "sem sessão": o usuário só precisa entrar de novo.
    const resultado = sessionSchema.safeParse(JSON.parse(bruto))
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

let atual: Session | null = lerDoArmazenamento()
let encerradaPeloUsuario = false

function notificar(): void {
  for (const ouvinte of ouvintes) {
    ouvinte()
  }
}

export function obterSessao(): Session | null {
  return atual
}

/** A sessão vale até o instante `expiresAt` definido pela API no login. */
export function sessaoValida(sessao: Session | null, agora = Date.now()): sessao is Session {
  return sessao !== null && Date.parse(sessao.expiresAt) > agora
}

export function iniciarSessao(sessao: Session): void {
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
export function useSessao(): Session | null {
  return useSyncExternalStore(assinarSessao, obterSessao, () => null)
}
