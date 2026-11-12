# @axis/contracts

Contrato da API do AXIS: schemas [Zod](https://zod.dev) compartilhados pela API (`apps/api`), pelo painel web (`apps/web`) e pelo app mobile (`apps/mobile`). É a fonte da verdade do formato dos dados trocados entre as frentes (decisão da issue #21).

## Como usar

Declare a dependência no `package.json` da frente:

```json
"dependencies": {
  "@axis/contracts": "workspace:*"
}
```

E importe os schemas e tipos:

```ts
import { customerSchema, pageOf, type Customer } from '@axis/contracts'
```

- **API:** valida a entrada e a saída das rotas com estes schemas (`fastify-type-provider-zod`) e gera o OpenAPI a partir deles.
- **Web e mobile:** usam os tipos e validam as respostas e os formulários com os mesmos schemas.

O pacote é consumido direto do código-fonte TypeScript, sem etapa de build.

## Convenções (issue #21)

| Item | Regra | Schema |
|---|---|---|
| IDs | UUID em texto (v7), pode ser gerado pelo app | `idSchema` |
| Instantes | ISO 8601 em UTC, terminado em `Z` | `instanteSchema` |
| Datas de calendário | `AAAA-MM-DD`, no fuso America/Sao_Paulo | `dataCalendarioSchema` |
| Dinheiro | Inteiro em centavos | `centavosSchema` |
| Paginação | `?page=1&perPage=20` (máx. 100) → `{ items, total, page, perPage }` | `paginationSchema`, `pageOf` |
| Erros | Problem Details (RFC 9457) com `codigo` e `erros` | `problemaSchema`, `errosDeValidacao` |
| CPF/CNPJ | Sem máscara, com dígitos verificadores conferidos; o CNPJ aceita o formato alfanumérico emitido desde julho de 2026 | `documentoSchema`, `normalizarDocumento` |
| CEP e telefone | Só dígitos; a máscara é da interface | `cepSchema`, `telefoneSchema`, `apenasDigitos` |

## Endpoints

Rotas e schemas em inglês (ADR 0001). Todas, menos o login e o `/health`, exigem `Authorization: Bearer <token>` e respondem `401 NAO_AUTENTICADO` sem um token válido. A coluna **Situação** diz se a rota já existe na API ou só tem o contrato pronto.

| Método | Caminho | Entrada | Respostas | Situação |
|---|---|---|---|---|
| GET | `/health` (sem `/v1` e sem login) | | 200 `healthSchema`; não consulta o banco | na API |
| POST | `/v1/auth/login` | `loginBodySchema` | 200 `sessionSchema` · 401 `CREDENCIAIS_INVALIDAS` · 422 `VALIDACAO` · 429 `MUITAS_TENTATIVAS` | na API |
| GET | `/v1/me` | | 200 `userSchema` · 401 `NAO_AUTENTICADO` | na API |
| GET | `/v1/customers` | `customerFiltersSchema` (query: página, busca, filtros e ordenação) | 200 `pageOf(customerSchema)` · 403 `SEM_PERMISSAO` | na API |
| GET | `/v1/customers/{id}` | | 200 `customerSchema` · 404 `NAO_ENCONTRADO` (também fora do escopo do perfil) | na API |
| POST | `/v1/customers` | `customerInputSchema` | 201 `customerSchema` · 403 · 409 `DOCUMENTO_JA_CADASTRADO` · 422 `VALIDACAO` | na API |
| PUT | `/v1/customers/{id}` | `customerInputSchema` | 200 `customerSchema` · 403 · 404 · 409 · 422 | na API |
| PATCH | `/v1/customers/{id}/status` | `customerStatusChangeSchema` | 200 `customerSchema` · 403 · 404 · 409 `TRANSICAO_INVALIDA` | na API |
| POST | `/v1/customers/{id}/approval` | | 200 `customerSchema` · 403 · 404 · 409 `TRANSICAO_INVALIDA` | na API |
| POST | `/v1/customers/{id}/rejection` | `customerRejectionSchema` | 200 `customerSchema` · 403 · 404 · 409 `TRANSICAO_INVALIDA` · 422 `VALIDACAO` | na API |
| GET | `/v1/products` | `productFiltersSchema` (query: busca, categoria, active, ordenação) | 200 `pageOf(productSchema)` · 401 | contrato |
| GET | `/v1/products/{id}` | | 200 `productSchema` · 404 `NAO_ENCONTRADO` | contrato |
| POST | `/v1/products` | `productInputSchema` | 201 `productSchema` · 403 · 409 `SKU_JA_CADASTRADO` · 422 `VALIDACAO` | contrato |
| PUT | `/v1/products/{id}` | `productInputSchema` | 200 `productSchema` · 403 · 404 · 409 `SKU_JA_CADASTRADO` · 422 | contrato |
| PATCH | `/v1/products/{id}/status` | `productStatusChangeSchema` | 200 `productSchema` · 403 · 404 · 422 | contrato |
| GET | `/v1/routes/today` | | 200 `routeDetailSchema` · 403 · 404 `SEM_ROTA_HOJE` | na API |
| GET | `/v1/routes/{id}` | | 200 `routeDetailSchema` · 403 · 404 | na API |
| GET | `/v1/routes` | `routeFiltersSchema` (query) | 200 `pageOf(routeSchema)` · 403 | na API |
| POST | `/v1/routes` | `createRouteBodySchema` | 201 `routeSchema` · 409 · 422 | contrato |
| GET | `/v1/dashboard` | `dashboardFiltersSchema` (query: `date`) | 200 `dashboardSummarySchema` · 403 | contrato |
| POST | `/v1/visits/{id}/check-in` | `checkInBodySchema` | 200 `visitSchema` · 404 · 422 | contrato |
| POST | `/v1/visits/{id}/check-out` | `checkOutBodySchema` | 200 `visitSchema` · 404 · 422 | contrato |

Os caminhos desta tabela são a proposta do contrato; cada ticket de API os confirma ao implementar.

## Códigos de erro

| Código | Status | Quando |
|---|---|---|
| `VALIDACAO` | 422 | Dados de entrada fora do contrato; `erros` lista campo e mensagem |
| `NAO_AUTENTICADO` | 401 | Sem token, token inválido ou sessão expirada |
| `CREDENCIAIS_INVALIDAS` | 401 | E-mail/matrícula ou senha incorretos no login |
| `SEM_PERMISSAO` | 403 | O perfil do usuário não pode fazer a ação |
| `NAO_ENCONTRADO` | 404 | O recurso não existe |
| `REQUISICAO_INVALIDA` | 4xx | Requisição malformada que não tem código próprio (ex.: JSON quebrado) |
| `MUITAS_TENTATIVAS` | 429 | Muitas tentativas de login (certas ou erradas) do mesmo endereço em pouco tempo |
| `ERRO_INTERNO` | 500 | Falha inesperada; a mensagem interna não é exposta |
| `DOCUMENTO_JA_CADASTRADO` | 409 | Já existe cliente com o mesmo CPF/CNPJ |
| `TRANSICAO_INVALIDA` | 409 | Mudança de estado que o cliente não admite (ex.: inativar prospecção pendente) |
| `SEM_ROTA_HOJE` | 404 | O Vendedor não tem rota montada para o dia |

## Nomes em inglês

O contrato usa só nomes em inglês (ADR 0001), conforme o [modelo de dados](../../docs/05-modelo-dados/README.md). A migração expand–contract terminou na #57: os schemas antigos em português (`auth.ts`, `clientes.ts`, `paginacaoSchema`, `paginaDe`) foram apagados depois que o painel web passou a usar os novos.

| Assunto | Arquivo e schemas |
|---|---|
| Usuário e login | `user.ts`: `roleSchema`, `PANEL_ROLES`, `userSchema`, `loginBodySchema`, `sessionSchema` |
| Cliente | `customer.ts`: `customerSchema`, `customerInputSchema`, `customerStatusChangeSchema`, `customerRejectionSchema`, `customerFiltersSchema` |
| Produto | `product.ts`: `productSchema`, `productInputSchema`, `productStatusChangeSchema`, `productSortFieldSchema`, `productFiltersSchema` |
| Rota | `route.ts`: `routeSchema`, `createRouteBodySchema`, `routeDetailSchema`, `routeFiltersSchema` |
| Dashboard | `dashboard.ts`: `dashboardFiltersSchema`, `dashboardSellerVisitsSchema`, `dashboardSummarySchema` |
| Visita | `visit.ts`: `visitSchema`, `checkInBodySchema`, `checkOutBodySchema`, `visitStatusOf` (estado derivado) |
| Paginação | `pagination.ts`: `paginationSchema` (`?page&perPage`), `pageOf` (`{ items, total, page, perPage }`) |

Ainda com nome em português, por serem convenções do #21 usadas também pela API e pelo app: `idSchema`, `instanteSchema`, `dataCalendarioSchema`, `centavosSchema`, `documentoSchema`, `normalizarDocumento`, `apenasDigitos` e o formato de erro `problemaSchema` (`codigo`, `erros`). Renomear o Problem Details mexe na API, no web e no mobile ao mesmo tempo e fica para um ticket próprio.

Regras que os schemas já aplicam: coordenadas obrigatórias no cliente; motivo obrigatório na prospecção rejeitada; justificativa obrigatória no check-in fora do raio e nos desfechos `customer_closed` e `not_performed`; check-out só depois do check-in e junto com o desfecho; o mesmo cliente não repete numa rota.

## Testes

```bash
pnpm --filter @axis/contracts test
```
