# AXIS: Painel web de gestão

Painel usado pela gestão (coordenadores, supervisores e diretores) para cadastrar clientes, montar rotas e acompanhar indicadores.

## Stack

- Vite + React + TypeScript
- React Router (rotas)
- TanStack Query (dados vindos da API)
- Tailwind CSS (estilo, tokens em `src/index.css`)
- MSW (API simulada em desenvolvimento)
- oxlint (lint)

## Como rodar

Pré-requisito: Node.js 20.19+ ou 22.12+.

```bash
cd apps/web
npm install
npm run dev
```

Abra o endereço mostrado no terminal (normalmente `http://localhost:5173`).

Em desenvolvimento, `.env.development` liga a API simulada (`VITE_USE_MOCKS=true`), então o painel funciona sem o backend. Para apontar para a API real, crie `.env.local` a partir de `.env.example`.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Checagem de tipos (`tsc`) e build de produção |
| `npm run lint` | Lint com oxlint |
| `npm run preview` | Serve o build de produção localmente |

## Estrutura

```
src/
  app/          rotas (router.tsx)
  components/   componentes compartilhados (layout)
  features/     código por domínio (ex.: clientes: tipos e queries)
  lib/          cliente HTTP e configuração do TanStack Query
  mocks/        API simulada (MSW): handlers e dados fictícios
  pages/        telas
public/
  mockServiceWorker.js   worker do MSW (gerado por `msw init`, não editar)
```

## Convenções

- Chamadas à API passam por `apiFetch` (`src/lib/api.ts`) e ficam em `queries.ts` de cada feature.
- Os handlers da API simulada seguem o contrato da API (`/v1/...`).
- Cores e fontes ficam só em `src/index.css`. A paleta de marca ainda está pendente.
- Dados em `src/mocks/data.ts` são fictícios.
