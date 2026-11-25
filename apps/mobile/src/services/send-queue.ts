/**
 * Estado da fila de envio (outbox, #27) como o resto do app a enxerga.
 *
 * - `idle`: nada a enviar.
 * - `pending`: há operação esperando envio (com rede, tentando; sem rede, esperando).
 * - `error`: o envio falhou e a fila parou.
 *
 * A fila de verdade (SQLite + outbox) ainda não existe. Quando existir, ela publica por esta
 * interface: passa por `pending` enquanto houver operação e só volta a `idle` quando a última foi
 * aceita pelo servidor. Quem depende do esvaziamento (releitura do Score, RF25) não muda.
 */
export type SendQueueStatus = 'idle' | 'pending' | 'error'

export type SendQueueListener = (status: SendQueueStatus) => void

export type SendQueue = {
  status(): SendQueueStatus
  /** Avisa a cada mudança de estado. Devolve a função que cancela o aviso. */
  subscribe(listener: SendQueueListener): () => void
}

/**
 * A fila esvaziou com sucesso? Só `pending → idle` conta: com pendência ou erro ainda não há o que
 * reler, e sair de `error` direto para `idle` não é envio aceito.
 */
export function wasDrained(previous: SendQueueStatus, next: SendQueueStatus): boolean {
  return previous === 'pending' && next === 'idle'
}

export type SendQueueControl = SendQueue & {
  /** Usado pela fila de verdade (e pelos testes) para publicar o estado. */
  setStatus(status: SendQueueStatus): void
}

/** Fila em memória: começa ociosa. É a implementação até a outbox existir. */
export function createSendQueue(initial: SendQueueStatus = 'idle'): SendQueueControl {
  let current = initial
  const listeners = new Set<SendQueueListener>()
  return {
    status: () => current,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    setStatus(status) {
      if (status === current) return
      current = status
      for (const listener of [...listeners]) listener(status)
    },
  }
}
