# Código, banco e API em inglês; português só na interface

Tabelas, colunas, entidades, schemas Zod, JSON e rotas da API ficam em inglês (`customer`, `/v1/customers`, `sellerId`). Só o texto da interface e os caminhos de página do web ficam em português. O glossário do domínio (`CONTEXT.md`) continua em português, e o mapeamento termo ↔ nome no código está em `docs/05-modelo-dados/README.md`.

Isso substitui a convenção de nomes do #21 ("termos do domínio em português: `cliente`, `rota`, `visita`"); o resto do #21 (monorepo, Zod como contrato, `/v1`, erros, paginação, datas, dinheiro) continua valendo. `packages/contracts` e o web já implementados precisam ser renomeados. A API devolve JSON em inglês, então os rótulos mostrados ao usuário são responsabilidade da interface.
