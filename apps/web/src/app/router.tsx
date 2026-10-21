import { createBrowserRouter } from 'react-router'
import { AppLayout } from '../components/AppLayout'
import { ClientesPage } from '../pages/ClientesPage'
import { DashboardPage } from '../pages/DashboardPage'
import { LoginPage } from '../pages/LoginPage'
import { NotFoundPage } from '../pages/NotFoundPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'clientes', element: <ClientesPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
