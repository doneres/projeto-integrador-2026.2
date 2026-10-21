# AXIS: Painel web de gestão

Painel usado pela gestão (coordenadores, supervisores e diretores) para cadastrar clientes, montar rotas e acompanhar indicadores.

## Stack

- Vite + React + TypeScript
- React Router (rotas)
- TanStack Query (dados vindos da API)
- Tailwind CSS (estilo, com tokens em `src/index.css`)
- MSW (API simulada em desenvolvimento)
- Biome (lint e formatação, configurado na raiz do repositório)

## Como rodar

Pré-requisitos: Node.js 24 LTS e pnpm (veja o README da raiz).

Na raiz do repositório:

```bash
pnpm install
pnpm dev:web
```

Abra o endereço mostrado no terminal (normalmente `http://localhost:5173`).

Em desenvolvimento, `.env.development` liga a API simulada (`VITE_USE_MOCKS=true`), então o painel funciona sem o backend. Para apontar para a API real, crie `.env.local` a partir de `.env.example`.

## Scripts

Dentro de `apps/web` (ou na raiz, com `pnpm --filter @axis/web <script>`):

| Comando | O que faz |
|---|---|
| `pnpm dev` | Servidor de desenvolvimento |
| `pnpm build` | Checagem de tipos (`tsc`) e build de produção |
| `pnpm typecheck` | Só a checagem de tipos |
| `pnpm preview` | Serve o build de produção localmente |

Lint e formatação rodam na raiz: `pnpm lint` verifica e `pnpm lint:fix` corrige.

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

- Chamadas à API passam por `apiFetch` (`src/lib/api.ts`) e ficam no `queries.ts` de cada feature.
- Os handlers da API simulada seguem o contrato da API (`/v1/...`).
- Cores e fontes ficam só em `src/index.css`. A paleta da marca ainda está pendente.
- Os dados em `src/mocks/data.ts` são fictícios.
- Nomes: termos do domínio em português (`cliente`, `rota`), termos técnicos de bibliotecas em inglês (`query`, `handler`, `schema`).
