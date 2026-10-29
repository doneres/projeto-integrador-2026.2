# App mobile local-first, com fila de envio própria

Toda escrita do app vai para o SQLite local (expo-sqlite + Drizzle) e para uma tabela `outbox` na mesma transação; um processador serial (FIFO pela sequência local, não pelo relógio) envia cada ação de negócio para a API, com ou sem rede. Descartamos mutations persistidas do TanStack Query (estado num blob, `maxAge` de 24 h e escrita com atraso, que podem perder ação se o app for morto) e bibliotecas de sync prontas (WatermelonDB, ElectricSQL, TinyBase, que trazem modelo de dados ou servidor próprio e não garantem a ordem da RN05). O TanStack Query fica só como cache de leitura.

Ter um único caminho (online e offline iguais) mantém o modo offline, o de maior risco para o R5, testado em todo uso. O custo é escrever e manter a fila (~1 tabela e 1 processador). Plano B, se ela travar na onda 1 do pós-beta: PowerSync.
