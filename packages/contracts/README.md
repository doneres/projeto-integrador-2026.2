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
import { clienteSchema, paginaDe, type Cliente } from '@axis/contracts'
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
| Paginação | `?pagina=1&porPagina=20` (máx. 100) → `{ itens, total, pagina, porPagina }` | `paginacaoSchema`, `paginaDe` |
| Erros | Problem Details (RFC 9457) com `codigo` e `erros` | `problemaSchema`, `errosDeValidacao` |
| CPF/CNPJ, CEP, telefone | Só dígitos; a máscara é da interface | `documentoSchema`, `cepSchema`, `telefoneSchema` |

## Entidades

| Entidade | Situação |
|---|---|
| `Cliente` | Provisória: campos da RF05/RF06, a confirmar na issue #26 |

## Testes

```bash
pnpm --filter @axis/contracts test
```
