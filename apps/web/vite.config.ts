import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Com a API real (VITE_USE_MOCKS=false e VITE_API_URL vazio), o painel chama /v1/... na
    // própria origem e o Vite repassa para a API local (pnpm dev:api). Para o navegador é a
    // mesma origem, então não há CORS. Com a API simulada, o MSW responde antes de chegar aqui.
    proxy: { '/v1': 'http://localhost:3000' },
  },
})
