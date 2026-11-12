import { createBrowserRouter } from 'react-router'
import { AppLayout } from '../components/AppLayout'
import { RotaProtegida } from '../features/auth/RotaProtegida'
import { ClienteFormPage } from '../pages/ClienteFormPage'
import { ClientesPage } from '../pages/ClientesPage'
import { DashboardPage } from '../pages/DashboardPage'
import { EmConstrucaoPage } from '../pages/EmConstrucaoPage'
import { LoginPage } from '../pages/LoginPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { ProspeccoesPage } from '../pages/ProspeccoesPage'
import { RotaDetalhePage } from '../pages/RotaDetalhePage'
import { RotaNovaPage } from '../pages/RotaNovaPage'
import { RotasPage } from '../pages/RotasPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RotaProtegida>
        <AppLayout />
      </RotaProtegida>
    ),
    children: [
      { index: true, element: <DashboardPage />, handle: { titulo: 'Painel' } },
      { path: 'clientes', element: <ClientesPage />, handle: { titulo: 'Clientes' } },
      { path: 'clientes/novo', element: <ClienteFormPage />, handle: { titulo: 'Novo cliente' } },
      {
        path: 'clientes/:id/editar',
        element: <ClienteFormPage />,
        handle: { titulo: 'Editar cliente' },
      },
      { path: 'rotas', element: <RotasPage />, handle: { titulo: 'Rotas' } },
      { path: 'rotas/nova', element: <RotaNovaPage />, handle: { titulo: 'Nova rota' } },
      { path: 'rotas/:id', element: <RotaDetalhePage />, handle: { titulo: 'Rota' } },
      { path: 'prospeccoes', element: <ProspeccoesPage />, handle: { titulo: 'Prospecções' } },
      { path: 'metas', element: <EmConstrucaoPage />, handle: { titulo: 'Metas' } },
      { path: 'materiais', element: <EmConstrucaoPage />, handle: { titulo: 'Materiais de PDV' } },
      { path: 'usuarios', element: <EmConstrucaoPage />, handle: { titulo: 'Usuários' } },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
