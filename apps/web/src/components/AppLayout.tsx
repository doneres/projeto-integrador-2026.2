import { NavLink, Outlet } from 'react-router'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm ${
    isActive ? 'bg-brand text-brand-foreground' : 'text-text-muted hover:bg-muted'
  }`

export function AppLayout() {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-border">
        <nav className="mx-auto flex max-w-6xl items-center gap-2 p-4">
          <span className="mr-4 font-bold">AXIS</span>
          <NavLink to="/" end className={linkClass}>
            Painel
          </NavLink>
          <NavLink to="/clientes" className={linkClass}>
            Clientes
          </NavLink>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl p-4">
        <Outlet />
      </main>
    </div>
  )
}
