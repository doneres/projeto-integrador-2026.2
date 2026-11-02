import { type LoginBody, loginBodySchema } from '@axis/contracts'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiRequestError, NetworkError, RequestTimeoutError } from '@/services/api-client'
import { useSession } from './session'

/** Depois deste tempo sem resposta, a tela avisa que o servidor está acordando. */
export const WAKING_DELAY_MS = 4_000

export const SELLER_ONLY_MESSAGE =
  'Este aplicativo é do Vendedor. Use o painel web para entrar com o seu perfil.'

export type LoginStatus = 'idle' | 'submitting' | 'waking'

/** Onde o foco deve ficar depois de um envio sem sucesso. */
export type LoginFocus = 'identifier' | 'password' | 'form'

export type SubmitResult = { ok: true } | { ok: false; focus: LoginFocus }

function messageFor(error: unknown): string {
  if (error instanceof RequestTimeoutError) {
    return 'O servidor não respondeu a tempo. Tente de novo em instantes.'
  }
  if (error instanceof NetworkError) {
    return 'Não foi possível conectar ao servidor. Confira a conexão e a URL da API.'
  }
  if (error instanceof ApiRequestError && (error.status === 401 || error.status === 429)) {
    return error.message
  }
  return 'Não foi possível entrar. Tente de novo.'
}

export function useLogin() {
  const { data, signIn } = useSession()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof LoginBody, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [status, setStatus] = useState<LoginStatus>('idle')
  const busy = useRef(false)
  const wakingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(wakingTimer.current), [])

  const submit = useCallback(async (): Promise<SubmitResult> => {
    if (busy.current) return { ok: false, focus: 'form' }

    const parsed = loginBodySchema.safeParse({ identifier, password })
    if (!parsed.success) {
      const errors: Partial<Record<keyof LoginBody, string>> = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof LoginBody
        errors[field] ??= issue.message
      }
      setFieldErrors(errors)
      setFormError(null)
      return { ok: false, focus: errors.identifier ? 'identifier' : 'password' }
    }

    busy.current = true
    setFieldErrors({})
    setFormError(null)
    setStatus('submitting')
    wakingTimer.current = setTimeout(() => setStatus('waking'), WAKING_DELAY_MS)
    try {
      const session = await data.auth.login(parsed.data)
      if (session.user.role !== 'seller') {
        setFormError(SELLER_ONLY_MESSAGE)
        return { ok: false, focus: 'form' }
      }
      await signIn(session)
      return { ok: true }
    } catch (error) {
      setFormError(messageFor(error))
      return { ok: false, focus: 'form' }
    } finally {
      clearTimeout(wakingTimer.current)
      busy.current = false
      setStatus('idle')
    }
  }, [data, identifier, password, signIn])

  return {
    identifier,
    setIdentifier,
    password,
    setPassword,
    fieldErrors,
    formError,
    status,
    submit,
  }
}
