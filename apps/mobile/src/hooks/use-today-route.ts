import type { RouteDetail } from '@axis/contracts'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { reconcileRoute } from '@/repositories/route-reconciliation'
import { NetworkError, RequestTimeoutError } from '@/services/api-client'
import { ApiUrlMissingError } from '@/services/api-url'
import { useSession } from './session'

export type TodayRouteState =
  | { status: 'loading' }
  | { status: 'ready'; route: RouteDetail }
  | { status: 'empty' }
  | { status: 'error'; message: string }

function messageFor(error: unknown): string {
  if (error instanceof ApiUrlMissingError) {
    return 'A URL da API não está configurada. Saia da conta e informe o endereço com um toque longo no logo AXIS.'
  }
  if (error instanceof RequestTimeoutError) {
    return 'O servidor não respondeu a tempo. Tente de novo em instantes.'
  }
  if (error instanceof NetworkError) {
    return 'Não foi possível conectar ao servidor. Confira a conexão e tente de novo.'
  }
  return 'Não foi possível carregar a rota do dia. Tente de novo.'
}

/**
 * Rota do dia do Vendedor e o quão fresca ela está.
 *
 * A rota é lida ao abrir a tela (o login leva a ela), ao voltar ao foreground com rede e em
 * `refresh` (botão "Atualizar"). Nunca em intervalo. Uma leitura que falha depois de a rota já
 * estar na tela não a apaga: `refreshError` avisa e `updatedAt` continua a hora da última leitura
 * que deu certo.
 */
export function useTodayRoute() {
  const { data } = useSession()
  const [state, setState] = useState<TodayRouteState>({ status: 'loading' })
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  // Só a leitura mais recente vale: uma resposta atrasada de uma tentativa antiga é descartada.
  const latest = useRef(0)
  const inFlight = useRef(false)
  const onScreen = useRef<RouteDetail | null>(null)
  const hasData = useRef(false)

  const settle = useCallback(
    (route: RouteDetail | null) => {
      onScreen.current = route
      hasData.current = true
      setUpdatedAt(data.now())
      setRefreshError(null)
      setState(route && route.visits.length > 0 ? { status: 'ready', route } : { status: 'empty' })
      inFlight.current = false
    },
    [data],
  )

  /** Primeira leitura e "Tentar de novo": sem rota na tela, mostra o loader. */
  const load = useCallback(() => {
    const attempt = ++latest.current
    inFlight.current = true
    setRefreshing(false)
    setState({ status: 'loading' })
    data.routes.today().then(
      (route) => {
        if (attempt !== latest.current) return
        settle(route)
      },
      (error: unknown) => {
        if (attempt !== latest.current) return
        inFlight.current = false
        setState({ status: 'error', message: messageFor(error) })
      },
    )
  }, [data, settle])

  /** Releitura com a rota já na tela: a lista fica, e uma falha vira aviso. */
  const refresh = useCallback(() => {
    if (inFlight.current) return
    if (!hasData.current) {
      load()
      return
    }
    const attempt = ++latest.current
    inFlight.current = true
    setRefreshing(true)
    data.routes.today().then(
      (incoming) => {
        if (attempt !== latest.current) return
        setRefreshing(false)
        settle(reconcileRoute(onScreen.current, incoming))
      },
      (error: unknown) => {
        if (attempt !== latest.current) return
        inFlight.current = false
        setRefreshing(false)
        setRefreshError(messageFor(error))
      },
    )
  }, [data, load, settle])

  useEffect(() => {
    load()
    return () => {
      latest.current++
    }
  }, [load])

  // Voltar ao app com rede relê a rota; sem rede, fica o que já está na tela.
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh
  useEffect(() => {
    let active = true
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return
      void data.connectivity.isOnline().then((online) => {
        if (active && online) refreshRef.current()
      })
    })
    return () => {
      active = false
      subscription.remove()
    }
  }, [data])

  return { state, updatedAt, refreshing, refreshError, refresh, retry: load }
}
