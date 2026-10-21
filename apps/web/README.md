# AXIS: Painel web de gestão

Painel usado pela gestão (coordenadores, supervisores e diretores) para cadastrar clientes, montar rotas e acompanhar indicadores.

## Stack

- Vite + React + TypeScript (modo estrito)
- React Router (rotas)
- TanStack Query (dados vindos da API)
- Contrato da API em [`@axis/contracts`](../../packages/contracts/README.md) (schemas Zod)
- Tailwind CSS (estilo, com tokens em `src/index.css`)
- MSW (API simulada em desenvolvimento)
- Vitest (testes)
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

### Usuários de teste (API simulada)

| Perfil | E-mail | Matrícula | Senha |
|---|---|---|---|
| Coordenador | `gestor@axis.example` | `1001` | `axis-demo-2026` |
| Vendedor | `vendedor@axis.example` | `2001` | `axis-demo-2026` |

São dados fictícios que só existem na API simulada (`src/mocks/data.ts`). O vendedor é barrado no painel, que é da gestão (RF02).

## Scripts

Dentro de `apps/web` (ou na raiz, com `pnpm --filter @axis/web <script>`):

| Comando | O que faz |
|---|---|
| `pnpm dev` | Servidor de desenvolvimento |
| `pnpm build` | Checagem de tipos (`tsc`) e build de produção |
| `pnpm typecheck` | Só a checagem de tipos |
| `pnpm test` | Testes automatizados (Vitest) |
| `pnpm preview` | Serve o build de produção localmente |

Lint e formatação rodam na raiz: `pnpm lint` verifica e `pnpm lint:fix` corrige.

## Sessão e segurança

- O login devolve um token e o instante em que ele expira. O painel guarda os dois no `localStorage` até a expiração ou até o usuário clicar em **Sair** (RF04).
- As rotas internas exigem sessão válida. Se a sessão expira ou a API responde 401, o painel volta ao login e, depois de entrar, retorna à página em que o usuário estava.
- Risco conhecido do `localStorage`: um script malicioso injetado na página (XSS) conseguiria ler o token. O React escapa todo o conteúdo exibido e o painel não usa HTML bruto. A alternativa, um cookie `httpOnly`, depende da API e entra na decisão da issue #20.

## Telas

O rascunho de baixa fidelidade das telas da beta está na página **Painel web — rascunho** do arquivo AXIS no Figma.

## Estrutura

```
src/
  app/          rotas (router.tsx)
  components/   layout e componentes de interface (components/ui)
  features/     código por domínio: auth (login e rota protegida) e clientes
  lib/          cliente HTTP (apiFetch), sessão, mensagens de erro e TanStack Query
  mocks/        API simulada (MSW): handlers e dados fictícios
  pages/        telas
public/
  mockServiceWorker.js   worker do MSW (gerado por `msw init`, não editar)
```

Os testes ficam ao lado do arquivo testado (`*.test.ts`).

## Convenções

- Toda chamada à API passa por `apiFetch` (`src/lib/api.ts`), que valida a resposta com o schema do contrato. Qualquer falha vira `ApiError`: sem conexão, erro HTTP no formato Problem Details (RFC 9457) ou resposta fora do contrato.
- As telas mostram erros com `mensagemDeErro` (`src/lib/erros.ts`) e tratam os estados de carregamento, erro e lista vazia.
- Erros 4xx não são repetidos automaticamente; falhas de conexão e erros 5xx são tentados de novo até duas vezes.
- As queries de cada domínio ficam em `features/<dominio>/queries.ts`.
- Os handlers da API simulada seguem o contrato (`/v1/...`), e os dados em `src/mocks/data.ts` são fictícios e validados contra o contrato nos testes.
- Cores e fontes ficam só em `src/index.css`. A paleta da marca ainda está pendente.
- Nomes: termos do domínio em português (`cliente`, `rota`), termos técnicos de bibliotecas em inglês (`query`, `handler`, `schema`).
