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

Em desenvolvimento, `.env.development` liga a API simulada (`VITE_USE_MOCKS=true`), então o painel funciona sem o backend. Para usar a API real local, suba a API (`pnpm db:up` e `pnpm dev:api`, veja [`apps/api`](../api/README.md)) e crie `.env.development.local` a partir de `.env.example` (`VITE_USE_MOCKS=false`, `VITE_API_URL` vazio). Tem que ser esse nome: no Vite, o `.env.development` vale mais que o `.env.local`, e com `.env.local` a API simulada continuaria ligada: o servidor do Vite repassa `/v1/...` para `http://localhost:3000`, sem CORS. As contas da API real vêm do seed: os e-mails e as matrículas são os mesmos da tabela abaixo, e as senhas estão no `.env` da API (veja [Seed e reset](../api/README.md#seed-e-reset)).

A API simulada roda num service worker. O recarregamento forçado (Ctrl+Shift+R) e a opção "Bypass for network" do DevTools pulam o service worker: as chamadas `/v1/...` vão para o Vite e voltam 404. Recarregue com F5. O "banco" simulado fica na memória e volta aos dados de exemplo a cada recarga.

### Usuários de teste (API simulada)

| Perfil | E-mail | Matrícula | Senha |
|---|---|---|---|
| Coordenador (Equipe A) | `gestor@axis.example` | `1001` | `axis-demo-2026` |
| Coordenador (Equipe B) | `coordenador.b@axis.example` | `1002` | `axis-demo-2026` |
| Diretor | `diretor@axis.example` | `3001` | `axis-demo-2026` |
| Administrador | `administrador@axis.example` | `4001` | `axis-demo-2026` |
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

## Tempo quase real (polling)

Decisão do spec #52: **"tempo real" = até 30 s depois de o servidor receber o dado** (cerca de um minuto ponta a ponta, somando o envio da fila do app). Sem SSE nem websocket.

- **Consultas vivas** usam `opcoesDeConsultaViva` (`src/lib/query-client.ts`): repetem a cada 30 s **só com a aba visível** e buscam na hora ao voltar o foco. Hoje: dashboard (#61), lista e detalhe das rotas com estado das Visitas e Flags de auditoria (#62).
- **Cadastros e formulários não fazem polling** (clientes, vendedores, montagem de rota). A atualização automática não mexe no que está sendo digitado: os formulários guardam o próprio estado.
- Cada tela viva mostra **"Atualizado às HH:mm:ss"**, um sinal de "Atualizando...", o botão **Atualizar** e a nota de que Visitas feitas sem sinal aparecem quando o Vendedor sincronizar.
- Se a busca falhar, o último dado continua na tela com o aviso **"sem atualizar desde HH:mm"** e o polling segue tentando sozinho. Um 401 durante o polling encerra a sessão e leva ao login, como no resto do painel.
- **Custo no Neon:** um painel visível mantém o banco acordado (autosuspend de ~5 min; ≈ 6 CU-h por dia de painel aberto, contra 100 CU-h/mês do plano grátis). Não deixe o painel aberto por dias fora das janelas de teste e de apresentação.

## Sessão e segurança

- O login devolve um token e o instante em que ele expira. O painel guarda os dois no `localStorage` até a expiração ou até o usuário clicar em **Sair** (RF04).
- As rotas internas exigem sessão válida. Se a sessão expira ou a API responde 401, o painel volta ao login e, depois de entrar, retorna à página em que o usuário estava.
- Risco conhecido do `localStorage`: um script malicioso injetado na página (XSS) conseguiria ler o token. O React escapa todo o conteúdo exibido e o painel não usa HTML bruto. A alternativa, um cookie `httpOnly`, depende da API e entra na decisão da issue #20.

## Telas

O rascunho de baixa fidelidade das telas da beta está na página **Painel web — rascunho** do arquivo AXIS no Figma.

## O que já funciona

- **Login e sessão:** e-mail ou matrícula (RF01), perfis da gestão (RF02) e Sair (RF04).
- **Layout base:** menu lateral, cabeçalho com o usuário e menu recolhível em tela pequena.
- **Clientes (RF05, RF06):** lista com busca por nome ou CPF/CNPJ, filtros de status, tipo e bairro na URL e paginação; cadastro e edição com validação de CPF/CNPJ (inclusive o CNPJ alfanumérico); inativar e reativar com confirmação na própria tela.
- **CEP (RF07):** preenche o endereço pelo ViaCEP, com a BrasilAPI de reserva e 5 s por serviço; se nenhum responder, o endereço é preenchido à mão.

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
- Os handlers da API simulada imitam a API real (`/v1/...`, mesmas regras e códigos de erro). Os testes passam cada resposta pelo schema do contrato (`src/mocks/handlers.test.ts`) e os dados em `src/mocks/data.ts` são fictícios e também validados.
- Cores e fontes ficam só em `src/index.css`. A paleta da marca ainda está pendente.
- Nomes: o que vem do contrato fica em inglês, como na API (`customer`, `tradeName`, `status: 'active'`, ADR 0001); a interface traduz para o usuário (ex.: `ROTULO_STATUS`). O código próprio do painel (componentes, funções, caminhos de página como `/clientes`) segue em português.
