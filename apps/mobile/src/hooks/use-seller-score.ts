import type { SellerScoreSummary } from '@axis/contracts'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { wasDrained } from '@/services/send-queue'
import { loadErrorMessage } from './load-error'
import { useSession } from './session'

export type SellerScoreState =
  | { status: 'loading' }
  | { status: 'ready'; summary: SellerScoreSummary }
  | { status: 'error'; message: string }

const messageFor = (error: unknown) =>
  loadErrorMessage(error, 'Não foi possível carregar o seu Score. Tente de novo.')

/**
 * Realizado e Score do mês do Vendedor (RF25), lidos do servidor e guardados em cache de leitura.
 *
 * A leitura acontece em três momentos e nunca em intervalo:
 * 1. ao abrir a tela (o último valor do cache aparece na hora, enquanto a leitura nova não chega);
 * 2. ao voltar ao foreground com rede;
 * 3. quando a fila de envio esvazia com sucesso (`pending → idle`): é aí que o Pedido que o Vendedor
 *    acabou de fazer chega ao servidor e muda o realizado. Com a fila pendente ou em erro não há o
 *    que reler.
 *
 * Uma leitura que falha depois de o valor já estar na tela não o apaga: `refreshError` avisa e
 * `updatedAt` continua a hora da última leitura que deu certo.
 */
export function useSellerScore() {
  const { state: session, data } = useSession()
  const sellerId = session.status === 'signedIn' ? session.session.user.id : null

  const initial = sellerId ? data.scores.cached(sellerId) : null
  const [state, setState] = useState<SellerScoreState>(
    initial ? { status: 'ready', summary: initial.summary } : { status: 'loading' },
  )
  const [updatedAt, setUpdatedAt] = useState<Date | null>(initial?.readAt ?? null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  // Só a leitura mais recente vale: uma resposta atrasada de uma tentativa antiga é descartada.
  const latest = useRef(0)
  const inFlight = useRef(false)
  const hasData = useRef(initial !== null)

  /**
   * `supersede`: a fila acabou de esvaziar, então uma leitura já em andamento pode ter começado
   * antes de o servidor receber o Pedido. Ela é descartada e uma nova começa. Os demais gatilhos
   * não abrem uma segunda leitura por cima de uma em andamento.
   */
  const read = useCallback(
    ({ supersede = false } = {}) => {
      if (inFlight.current && !supersede) return
      const attempt = ++latest.current
      inFlight.current = true
      setRefreshing(hasData.current)
      data.scores.read().then(
        (summary) => {
          if (attempt !== latest.current) return
          inFlight.current = false
          hasData.current = true
          setUpdatedAt(data.scores.cached(summary.sellerId)?.readAt ?? data.now())
          setRefreshError(null)
          setRefreshing(false)
          setState({ status: 'ready', summary })
        },
        (error: unknown) => {
          if (attempt !== latest.current) return
          inFlight.current = false
          setRefreshing(false)
          if (hasData.current) setRefreshError(messageFor(error))
          else setState({ status: 'error', message: messageFor(error) })
        },
      )
    },
    [data],
  )

  /** "Tentar de novo" sem valor na tela: volta ao loader. */
  const retry = useCallback(() => {
    if (!hasData.current) setState({ status: 'loading' })
    read({ supersede: true })
  }, [read])

  /** Botão "Atualizar": relê, a menos que já haja uma leitura em andamento. */
  const refresh = useCallback(() => read(), [read])

  const readRef = useRef(read)
  readRef.current = read

  // Abrir a tela. Se o Vendedor da sessão mudar com a tela montada, o valor do anterior sai e a
  // leitura recomeça: o Score de um Vendedor nunca fica na tela de outro.
  useEffect(() => {
    const cached = sellerId ? data.scores.cached(sellerId) : null
    hasData.current = cached !== null
    setState(cached ? { status: 'ready', summary: cached.summary } : { status: 'loading' })
    setUpdatedAt(cached?.readAt ?? null)
    setRefreshError(null)
    readRef.current()
    return () => {
      latest.current++
      inFlight.current = false
    }
  }, [data, sellerId])

  // Voltar ao app com rede relê; sem rede, fica o que já está na tela.
  useEffect(() => {
    let active = true
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return
      void data.connectivity.isOnline().then((online) => {
        if (active && online) readRef.current()
      })
    })
    return () => {
      active = false
      subscription.remove()
    }
  }, [data])

  // A fila esvaziou com sucesso: o servidor já tem o que o Vendedor fez.
  useEffect(() => {
    let previous = data.sendQueue.status()
    return data.sendQueue.subscribe((status) => {
      const drained = wasDrained(previous, status)
      previous = status
      if (drained) readRef.current({ supersede: true })
    })
  }, [data])

  return { state, updatedAt, refreshing, refreshError, refresh, retry }
}
