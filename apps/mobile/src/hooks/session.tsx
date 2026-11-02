import type { Session } from '@axis/contracts'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { AppState } from 'react-native'
import { type AppData, getAppData } from '@/repositories/app-data'

export type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; session: Session }

type SessionContextValue = {
  state: SessionState
  data: AppData
  signIn(session: Session): Promise<void>
  signOut(): Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

type SessionProviderProps = {
  children: ReactNode
  /** Padrão: o armazenamento seguro do aparelho e a API do ambiente. Os testes passam um falso. */
  data?: AppData
  now?: () => Date
}

const systemNow = () => new Date()

/** setTimeout estoura acima de 2^31 ms; uma sessão dura 8 h, mas o teto protege de um relógio estranho. */
const MAX_TIMER_MS = 2 ** 31 - 1

export function SessionProvider({
  children,
  data = getAppData(),
  now = systemNow,
}: SessionProviderProps) {
  const [state, setState] = useState<SessionState>({ status: 'loading' })

  const signOut = useCallback(async () => {
    setState({ status: 'signedOut' })
    await data.sessions.clear()
  }, [data])

  const signIn = useCallback(
    async (session: Session) => {
      await data.sessions.save(session)
      setState({ status: 'signedIn', session })
    },
    [data],
  )

  // Restaura a sessão guardada; o repositório já descarta a vencida.
  useEffect(() => {
    let active = true
    data.sessions.load().then((session) => {
      if (active) setState(session ? { status: 'signedIn', session } : { status: 'signedOut' })
    })
    return () => {
      active = false
    }
  }, [data])

  // 401 em qualquer chamada autenticada: o token não vale mais.
  useEffect(() => data.onUnauthorized(() => void signOut()), [data, signOut])

  // A sessão vence com o app aberto (timer) ou enquanto ele esteve em segundo plano (AppState).
  const expiresAt = state.status === 'signedIn' ? state.session.expiresAt : null
  useEffect(() => {
    if (expiresAt === null) return
    const remaining = () => new Date(expiresAt).getTime() - now().getTime()
    const timer = setTimeout(() => void signOut(), Math.min(Math.max(remaining(), 0), MAX_TIMER_MS))
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && remaining() <= 0) void signOut()
    })
    return () => {
      clearTimeout(timer)
      subscription.remove()
    }
  }, [expiresAt, now, signOut])

  const value = useMemo(() => ({ state, data, signIn, signOut }), [state, data, signIn, signOut])
  return <SessionContext value={value}>{children}</SessionContext>
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession precisa estar dentro de <SessionProvider>')
  return value
}
