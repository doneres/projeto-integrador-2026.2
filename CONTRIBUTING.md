# Como Contribuir

Este documento descreve o fluxo de trabalho adotado no projeto.

## Fluxo de Branches

- **`main`** — branch estável, protegida. Ninguém commita direto aqui.
- **`feature/nome-da-feature`** — para novas funcionalidades (ex: `feature/checkin-geolocalizacao`)
- **`fix/nome-do-bug`** — para correções de bug
- **`docs/nome-do-documento`** — para mudanças exclusivas de documentação
- **`chore/nome-da-tarefa`** — para manutenção/config (ex: `chore/ajusta-workflow-lint`)

## Padrão de Commits

Este projeto segue o padrão [Conventional Commits](https://www.conventionalcommits.org/):

| Prefixo | Quando usar |
|---|---|
| `feat:` | nova funcionalidade |
| `fix:` | correção de bug |
| `docs:` | documentação |
| `style:` | formatação, sem mudança de lógica |
| `refactor:` | refatoração sem mudar comportamento |
| `test:` | adição/ajuste de testes |
| `chore:` | manutenção (configs, dependências, etc.) |

Exemplo:

```
feat: adiciona check-in de visita via geolocalização
```

## Como Abrir um Pull Request

1. Crie uma branch a partir da `main` seguindo a nomenclatura acima
2. Faça commits seguindo o padrão Conventional Commits
3. Abra um Pull Request para a `main`, vinculando a issue relacionada (`Closes #numero`)
4. Aguarde pelo menos 1 aprovação de outro integrante
5. Resolva todos os comentários da revisão antes do merge
6. Após aprovado, faça o merge (o CI de lint precisa passar)

## Rodando o Lint Localmente

Antes de abrir o PR, rode o lint na pasta correspondente à sua mudança:

```bash
cd backend && npm run lint
cd frontend && npm run lint
cd mobile && npm run lint
```

## Labels

- `bug` — problema/erro
- `enhancement` — nova funcionalidade
- `docs` — documentação
- `backend` / `frontend` / `mobile` — área do projeto