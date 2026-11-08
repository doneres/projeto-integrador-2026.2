# AXIS: API

API REST do AXIS, usada pelo painel web e pelo app do vendedor.

## Stack

- Node.js 24 e TypeScript estrito
- Fastify 5 com `fastify-type-provider-zod`: as rotas validam entrada e saída com os schemas de [`@axis/contracts`](../../packages/contracts/README.md)
- Documentação Swagger/OpenAPI gerada desses mesmos schemas e servida pelo Scalar
- Drizzle ORM e Postgres (Docker Compose em dev; Neon em produção)
- Vitest, com testes de integração via `app.inject()` contra um Postgres real

## Como rodar

Pré-requisitos: Node.js 24 LTS, pnpm e Docker (veja o README da raiz). Na raiz do repositório:

```bash
pnpm install
pnpm db:up                                    # sobe o Postgres local (Docker Compose)
cp apps/api/.env.example apps/api/.env        # valores de dev, nada secreto
pnpm dev:api                                  # aplica as migrations e escuta em http://localhost:3000
```

- Saúde: `GET http://localhost:3000/health`
- Contas e parâmetros: `pnpm --filter @axis/api db:seed` cria uma conta por perfil (veja [Seed e reset](#seed-e-reset))
- Documentação: `http://localhost:3000/docs/` (o JSON do OpenAPI está em `/docs/openapi.json`)

Se a porta 5432 já estiver ocupada por outro Postgres, suba com `POSTGRES_PORT=5433 pnpm db:up` e troque a porta nas duas URLs do `.env`. Para parar o banco: `pnpm db:down` (os dados ficam no volume; `docker compose down -v` apaga tudo).

## Ambiente

O ambiente é validado com Zod ao subir. Se faltar variável ou alguma for inválida, a API não inicia e a mensagem diz qual. As variáveis estão em [`.env.example`](./.env.example):

| Variável | Para quê |
|---|---|
| `NODE_ENV` | `development` (padrão), `test` ou `production` |
| `PORT` | Porta HTTP (padrão `3000`; o Render define a sua) |
| `DATABASE_URL` | Conexão das requisições (no Neon, a URL com pooler) |
| `DATABASE_URL_UNPOOLED` | Conexão direta, sem pooler, usada pelas migrations |
| `JWT_SECRET` | Segredo que assina os tokens de login (mínimo de 32 caracteres) |
| `SEED_PASSWORD_SELLER`, `SEED_PASSWORD_COORDINATOR`, `SEED_PASSWORD_DIRECTOR`, `SEED_PASSWORD_ADMINISTRATOR` | Senhas das contas do seed. Só o comando de seed as lê: a API sobe sem elas, e o Render não precisa delas |

## Usuários e login

- `POST /v1/auth/login` recebe `{ identifier, password }` (e-mail ou matrícula) e devolve `{ token, expiresAt, user }`. O token é um JWT HS256 de 8 horas; não há refresh token nem autocadastro. A senha fica guardada com argon2id.
- Rotas protegidas usam `preHandler: app.authenticate` e recebem o usuário e o perfil em `request.user`. A cada requisição a API busca a conta no banco: se não existir ou estiver desativada, responde `401 NAO_AUTENTICADO`, mesmo com o token ainda válido. `GET /v1/me` é a rota de exemplo.
- O login é limitado por endereço (padrão em `DEFAULT_LOGIN_RATE_LIMIT`: 30 tentativas por minuto, contando acertos e erros) (`429 MUITAS_TENTATIVAS`). Atrás do proxy do Render, `trustProxy: 1` (ligado quando `NODE_ENV=production`) faz o endereço vir do `X-Forwarded-For`, confiando só nesse salto para o cliente não forjar o cabeçalho. O contador fica na memória de cada instância e zera a cada deploy.
- Conta inexistente, senha errada e conta desativada respondem o mesmo `401 CREDENCIAIS_INVALIDAS`, para não revelar se o e-mail ou a matrícula existe.
- O banco garante que o coordenador do vendedor é mesmo um coordenador (trigger em `drizzle/0002_coordinator_rule.sql`). Usuário só é criado por `createUser` ([`src/users/create-user.ts`](./src/users/create-user.ts)), usado pelo seed e pelos testes; a tela do Administrador vem em outro ticket.

## Seed e reset

O seed cria os Parâmetros do sistema (raio de 100 m; pesos 50/30/20) e uma conta por perfil. A senha de cada conta vem da variável do seu perfil, sem valor padrão no código:

| Perfil | E-mail | Matrícula | Senha em |
|---|---|---|---|
| Coordenador | `gestor@axis.example` | `1001` | `SEED_PASSWORD_COORDINATOR` |
| Vendedor (Equipe do Coordenador) | `vendedor@axis.example` | `2001` | `SEED_PASSWORD_SELLER` |
| Diretor | `diretor@axis.example` | `3001` | `SEED_PASSWORD_DIRECTOR` |
| Administrador | `administrador@axis.example` | `4001` | `SEED_PASSWORD_ADMINISTRATOR` |

### Em dev

```bash
pnpm --filter @axis/api db:seed    # as senhas vêm do .env copiado do .env.example
pnpm --filter @axis/api db:reset   # zera os dados, sem confirmação
```

O banco precisa estar migrado: suba a API ao menos uma vez antes do primeiro seed.

- **O seed pode rodar de novo.** Ele só cria o que falta e não mexe no que já existe: um raio ajustado, uma senha trocada e uma conta desativada continuam como estão. Por isso, trocar uma variável de senha não muda a senha de uma conta existente. Para recomeçar do zero: `db:reset` e depois `db:seed`.
- **O reset** apaga os dados de todas as tabelas, mas mantém as tabelas e o histórico das migrations.
- **Banco de dev antigo:** as contas `@axis.dev` do seed anterior não somem sozinhas. Rode `db:reset` e `db:seed` uma vez para ficar só com as contas acima.
- **O deploy nunca roda seed nem reset:** a subida da API só aplica migrations, e os dois comandos ficam fora do `dist/server.js`.

### Em production (Neon)

O Render Free não tem shell, então os comandos rodam da máquina de um integrante, contra a **URL direta (sem pooler)** do Neon. As variáveis do terminal valem mais que as do `.env`:

```bash
export NODE_ENV=production
export DATABASE_URL_UNPOOLED='postgres://...'      # URL direta, do painel do Neon
export SEED_PASSWORD_SELLER='...'                  # as quatro senhas, do gerenciador de senhas
export SEED_PASSWORD_COORDINATOR='...'
export SEED_PASSWORD_DIRECTOR='...'
export SEED_PASSWORD_ADMINISTRATOR='...'

pnpm --filter @axis/api db:reset                   # recusa e mostra o host de destino
pnpm --filter @axis/api db:reset --confirm=<host>  # confira o host: isto apaga tudo
pnpm --filter @axis/api db:seed
```

Cuidados:

- Qualquer banco fora da máquina local é tratado como production, mesmo sem `NODE_ENV=production`. Assim, apontar a URL para o Neon com o `.env` de dev não zera o banco real sem a confirmação.
- A confirmação é o próprio host de destino: só vale se for igual ao da URL.
- Nesse caso o seed recusa as senhas do `.env.example`, que são públicas.
- Feche o terminal ao terminar, para não rodar outro comando contra o Neon sem querer.

## Clientes e rotas

- **Escopo por perfil** ([`src/access/scope.ts`](./src/access/scope.ts)): o Vendedor lê só as próprias rotas e os clientes delas (mais as prospecções que ele cadastrou); o Coordenador, a sua Equipe; o Diretor, tudo; o Administrador recebe `403 SEM_PERMISSAO`. Recurso fora do escopo responde `404`, igual a um que não existe.
- `GET /v1/routes/today` é a tela do dia do Vendedor: a rota de hoje (data de calendário em America/Sao_Paulo) com as Visitas pela `position`, o `status` derivado de cada uma e o Cliente. Sem rota no dia, `404 SEM_ROTA_HOJE`. `GET /v1/routes/{id}` e `GET /v1/routes` servem à gestão.
- O estado da Visita (Pendente, Em andamento, Concluída, Não realizada) não é coluna: vem de `visitStatusOf`, de `@axis/contracts`.
- `GET /v1/customers` pagina e aceita `search` (nome fantasia, razão social ou CPF/CNPJ), `status`, `origin`, `district`, `sortBy` e `order`. Só o Coordenador cadastra (`POST`), edita (`PUT`) e inativa ou reativa (`PATCH .../status`) clientes da própria Equipe, sempre com coordenadas. Não existe exclusão.
- `buildApp` aceita `now`, um relógio injetável: os testes o usam para provar o corte do dia em São Paulo.

## Migrations

As migrations ficam em `drizzle/` e rodam ao subir a API, antes de escutar, pela `DATABASE_URL_UNPOOLED`.

Colunas em `snake_case` no banco e `camelCase` no código (`casing: 'snake_case'` no Drizzle). Depois de mudar `src/db/schema.ts`, gere a migration e versione os arquivos criados:

```bash
pnpm --filter @axis/api db:generate
```

## Testes

```bash
pnpm db:up     # o Postgres precisa estar de pé
pnpm test
```

Os testes de integração passam por `app.inject()`, sem abrir porta, e usam o Postgres real (nunca mock nem SQLite). O banco vem de `DATABASE_URL` (padrão: o do Compose, `postgres://axis:axis@localhost:5432/axis`). O isolamento é por arquivo de teste: antes da suíte, um banco modelo recebe as migrations; cada arquivo copia esse modelo em `beforeAll` (`createTestDatabase()` em `test/support/database.ts`) e o apaga em `afterAll`. Os arquivos rodam em paralelo sem enxergar os dados uns dos outros. Os bancos de teste têm o prefixo `axis_test_` e o próprio `axis` de desenvolvimento não é tocado.

## Build

```bash
pnpm --filter @axis/api build   # gera dist/server.js
pnpm --filter @axis/api start   # node dist/server.js
```

O build empacota o código da API junto com `@axis/contracts` (TypeScript sem etapa de build); as demais dependências são lidas do `node_modules`.
