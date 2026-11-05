import type { RouteDetail } from '@axis/contracts'
import { useCallback, useEffect, useRef, useState } from 'react'
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

/** Rota do dia do Vendedor: carrega ao abrir a tela e de novo a cada `retry`. */
export function useTodayRoute() {
  const { data } = useSession()
  const [state, setState] = useState<TodayRouteState>({ status: 'loading' })
  // Só a leitura mais recente vale: uma resposta atrasada de uma tentativa antiga é descartada.
  const latest = useRef(0)

  const load = useCallback(() => {
    const attempt = ++latest.current
    setState({ status: 'loading' })
    data.routes.today().then(
      (route) => {
        if (attempt !== latest.current) return
        setState(
          route && route.visits.length > 0 ? { status: 'ready', route } : { status: 'empty' },
        )
      },
      (error: unknown) => {
        if (attempt !== latest.current) return
        setState({ status: 'error', message: messageFor(error) })
      },
    )
  }, [data])

  useEffect(() => {
    load()
    return () => {
      latest.current++
    }
  }, [load])

  return { state, retry: load }
}
