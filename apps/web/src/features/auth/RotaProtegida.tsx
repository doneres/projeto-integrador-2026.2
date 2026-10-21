import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { sessaoEncerradaPeloUsuario, sessaoValida, useSessao } from '../../lib/sessao'

/**
 * Mostra o conteúdo só com sessão válida; senão, leva ao login.
 * Se a sessão expirou, o login volta para a página pedida; depois de um Sair, começa do início.
 */
export function RotaProtegida({ children }: { children: ReactNode }) {
  const sessao = useSessao()
  const local = useLocation()

  if (!sessaoValida(sessao)) {
    const estado = sessaoEncerradaPeloUsuario()
      ? undefined
      : { voltarPara: `${local.pathname}${local.search}` }
    return <Navigate to="/login" replace state={estado} />
  }
  return children
}
