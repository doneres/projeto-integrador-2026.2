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

## Migrations

As migrations ficam em `drizzle/` e rodam ao subir a API, antes de escutar, pela `DATABASE_URL_UNPOOLED`.

Depois de mudar `src/db/schema.ts`, gere a migration e versione os arquivos criados:

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
