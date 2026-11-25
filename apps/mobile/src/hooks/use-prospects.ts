import type { Prospect } from '@axis/contracts'
import { useCallback, useEffect, useRef, useState } from 'react'
import { loadErrorMessage } from './load-error'
import { useSession } from './session'

export type ProspectsState =
  | { status: 'loading' }
  | { status: 'ready'; prospects: Prospect[] }
  | { status: 'empty' }
  | { status: 'error'; message: string }

/** As Prospecções do Vendedor: carrega ao abrir a tela e de novo a cada `retry`. */
export function useProspects() {
  const { data } = useSession()
  const [state, setState] = useState<ProspectsState>({ status: 'loading' })
  // Só a leitura mais recente vale: uma resposta atrasada de uma tentativa antiga é descartada.
  const latest = useRef(0)

  const load = useCallback(() => {
    const attempt = ++latest.current
    setState({ status: 'loading' })
    data.prospects.list().then(
      (prospects) => {
        if (attempt !== latest.current) return
        setState(prospects.length > 0 ? { status: 'ready', prospects } : { status: 'empty' })
      },
      (error: unknown) => {
        if (attempt !== latest.current) return
        setState({
          status: 'error',
          message: loadErrorMessage(
            error,
            'Não foi possível carregar as prospecções. Tente de novo.',
          ),
        })
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
