import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useMatches } from 'react-router'
import { encerrarSessao, useSessao } from '../lib/sessao'
import { Botao } from './ui/Botao'

const SECOES = [
  { caminho: '/', rotulo: 'Painel' },
  { caminho: '/clientes', rotulo: 'Clientes' },
  { caminho: '/rotas', rotulo: 'Rotas' },
  { caminho: '/prospeccoes', rotulo: 'Prospecções' },
  { caminho: '/metas', rotulo: 'Metas' },
  { caminho: '/materiais', rotulo: 'Materiais de PDV' },
  { caminho: '/usuarios', rotulo: 'Usuários' },
]

const ROTULO_PERFIL = {
  vendedor: 'Vendedor',
  coordenador: 'Coordenador',
  diretor: 'Diretor',
  administrador: 'Administrador',
} as const

type Handle = { titulo?: string }

/** Layout base: menu lateral (recolhível em tela pequena), cabeçalho com o usuário e o conteúdo da rota. */
export function AppLayout() {
  const sessao = useSessao()
  const queryClient = useQueryClient()
  const [menuAberto, setMenuAberto] = useState(false)
  const titulo =
    useMatches()
      .map((rota) => (rota.handle as Handle | undefined)?.titulo)
      .filter((t): t is string => Boolean(t))
      .at(-1) ?? 'AXIS'

  useEffect(() => {
    if (!menuAberto) {
      return
    }
    const fecharComEsc = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        setMenuAberto(false)
      }
    }
    window.addEventListener('keydown', fecharComEsc)
    return () => window.removeEventListener('keydown', fecharComEsc)
  }, [menuAberto])

  function sair() {
    encerrarSessao('saida')
    queryClient.clear()
  }

  return (
    <div className="min-h-dvh md:flex">
      {menuAberto && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-10 bg-black/30 md:hidden"
          onClick={() => setMenuAberto(false)}
        />
      )}
      <nav
        id="menu-principal"
        aria-label="Menu principal"
        className={`${menuAberto ? 'flex' : 'hidden'} fixed inset-y-0 left-0 z-20 w-60 flex-col gap-1 bg-muted p-5 md:static md:flex md:min-h-dvh`}
      >
        <span className="mb-4 text-xl font-bold">AXIS</span>
        {SECOES.map((secao) => (
          <NavLink
            key={secao.caminho}
            to={secao.caminho}
            end={secao.caminho === '/'}
            onClick={() => setMenuAberto(false)}
            className={({ isActive }) =>
              `rounded-md px-3 py-2 text-sm ${isActive ? 'bg-brand text-brand-foreground' : 'text-text-muted hover:bg-surface'}`
            }
          >
            {secao.rotulo}
          </NavLink>
        ))}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <Botao
              variante="secundario"
              className="md:hidden"
              aria-expanded={menuAberto}
              aria-controls="menu-principal"
              onClick={() => setMenuAberto((aberto) => !aberto)}
            >
              Menu
            </Botao>
            <h1 className="text-xl font-bold">{titulo}</h1>
          </div>
          <div className="flex items-center gap-3">
            {sessao && (
              <span className="hidden text-sm text-text-muted sm:inline">
                {sessao.usuario.nome} · {ROTULO_PERFIL[sessao.usuario.perfil]}
              </span>
            )}
            <Botao variante="secundario" onClick={sair}>
              Sair
            </Botao>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
