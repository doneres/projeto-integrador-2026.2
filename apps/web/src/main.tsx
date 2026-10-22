import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './app/router'
import { queryClient } from './lib/query-client'
import './index.css'

// Em desenvolvimento, o MSW intercepta as chamadas /v1/... e responde com dados fictícios.
async function enableMocking() {
  if (import.meta.env.VITE_USE_MOCKS !== 'true') return
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledFrame: 'bypass' })
}

const raiz = document.getElementById('root')
if (!raiz) {
  throw new Error('Elemento #root não encontrado no index.html')
}

enableMocking().then(() => {
  createRoot(raiz).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
})
