# Projeto Integrador PUC GOIAS 2026.2

## Tema

Sistema de gestão de força de vendas externa para empresas de pequeno/médio porte. O sistema resolve a falta de visibilidade que coordenadores e supervisores têm sobre o trabalho do vendedor em campo — otimizando rotas, comprovando visitas via check-in por geolocalização, controlando o inventário de materiais de ponto de venda (PDV) e acompanhando o cumprimento de metas em tempo real.

O projeto é dividido em duas frentes: um **painel web**, usado pela gestão para cadastrar clientes, montar rotas e acompanhar indicadores; e um **aplicativo mobile**, usado pelo vendedor para executar a rota do dia, fazer check-in nas visitas, atualizar o inventário, registrar prospecções e realizar vendas de reposição.

📄 Documentação completa em [`/docs`](./docs)

## Stack Tecnológica

- **Backend:** Node.js + TypeScript
- **Frontend Web:** React + TypeScript
- **Mobile:** React Native

## Estrutura do Repositório

Monorepo com pnpm workspaces (decisão registrada na issue #21):

- `apps/api/` — API REST (Fastify)
- `apps/web/` — Painel web de gestão (React)
- `apps/mobile/` — App do vendedor (Expo)
- `packages/contracts/` — Contrato da API: schemas Zod compartilhados pelas três frentes
- `docs/` — Documentação do projeto (visão, requisitos, casos de uso, diagramas)

## Como Rodar

Pré-requisitos: Node.js 24 LTS (versão em `.nvmrc`) e pnpm (`npm install -g pnpm`).

```bash
pnpm install     # instala as dependências de todas as frentes
pnpm dev:web     # sobe o painel web em modo de desenvolvimento
pnpm lint        # lint e formatação (Biome)
pnpm typecheck   # checagem de tipos
pnpm test        # testes automatizados
```

Instruções de cada frente ficam no README da própria pasta (ex.: [`apps/web`](./apps/web/README.md)).

## Materias

- FERRAMENTAS VISUAIS DE DESENVOLVIMENTO DE SOFTWARE
- DESENVOLVIMENTO DE APLICATIVOS P/ DISPOSITIVOS MOVÉIS
- PROGRAMAÇÃO ORIENTADA A OBJETOS COM BANCO DE DADOS
- GERÊNCIA DE PROJETOS DE SISTEMAS
- GOVERNANÇA EM TECNOLOGIA DA INFORMAÇÃO

## Integrantes

- [Douglas Cavalcanti - 20242012000180](https://github.com/doneres)
- [Guilherme Breder   - 20251012000341](https://github.com/gbreder)
- [João Victor Castro - 20251012000180](https://github.com/jvfsccp)