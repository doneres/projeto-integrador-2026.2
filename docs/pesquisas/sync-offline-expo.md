# Pesquisa: persistência local e sync offline no Expo

> Issue: #22 · Alimenta a decisão "Estratégia de sync offline"
> Pesquisa feita em **2026-10-12**. Fontes primárias (docs oficiais, repositórios, npm registry, GitHub API) consultadas nessa data. Versões conferidas com `npm view <pacote> dist-tags` e `gh api` no mesmo dia.

## Pergunta

Quais são as opções viáveis de **persistência local + sincronização offline** para o app **Expo (SDK atual)** do AXIS, que precisa registrar **check-in com GPS**, **auditoria de materiais de PDV com fotos** e **pedidos de venda** sem conexão e sincronizar depois com a nossa API **Node.js + Fastify + DrizzleORM + PostgreSQL**?

### Requisitos e restrições do nosso cenário

- **RN05:** operações offline vão para uma fila local com o timestamp do momento da ação. Ao reconectar, são enviadas em ordem cronológica, preservando a sequência check-in → auditoria → pedido → check-out.
- **RNF01:** offline-first. Os dados ficam persistidos localmente (AsyncStorage/SQLite) e são sincronizados automaticamente ao reconectar.
- **Norteador R5:** armazenamento local estruturado, com comportamento definido sem conectividade.
- Stack mobile já decidida: React Native + Expo + NativeWind. O web usa TanStack Query.
- 3 estudantes, ~7 semanas até a entrega final, com beta em **06/11/2026**. O APK precisa rodar em Android físico ≥ 8.0.

### Contexto da plataforma (verificado)

| Item | Valor em 2026-10-12 | Fonte |
|---|---|---|
| Expo SDK estável | **57** (lançado em 30/06/2026). O SDK 58 está em beta desde 15/09/2026 | <https://expo.dev/changelog> · npm `expo` `latest` = 57.0.28, `next` = 58.0.7 |
| React Native do SDK 57 | **0.86** | <https://docs.expo.dev/versions/latest/> |
| Android mínimo do SDK 57 | **Android 7+**, compile/target SDK 36. Atende o "≥ 8.0" com folga | <https://docs.expo.dev/versions/latest/> |
| New Architecture | **Obrigatória** desde o SDK 55: "SDK 55 and later run entirely on the New Architecture", "always enabled and cannot be disabled" | <https://docs.expo.dev/guides/new-architecture/> |

A última linha pesa muito: **qualquer lib nativa que ainda dependa da arquitetura antiga é um risco real no SDK 57**. É o caso do WatermelonDB (seção 4).

---

## Resumo comparativo

| Opção | Expo Go? | Serviço externo? | Esforço no backend | Fotos offline | Manutenção (out/2026) | Veredito p/ AXIS |
|---|---|---|---|---|---|---|
| **expo-sqlite + Drizzle + outbox próprio** | **Sim** (expo-sqlite "Included in Expo Go") | Não | Médio: endpoints idempotentes + IDs UUID do cliente | Manual: `expo-file-system` + fila de upload | expo-sqlite 57.0.4 (SDK 57). Drizzle 0.45.4 estável (08/10/2026), v1 em RC | **Recomendado** |
| **TanStack Query + mutations persistidas** | Sim (JS puro + AsyncStorage/kv-store) | Não | Médio (o mesmo contrato idempotente) | Não resolve: arquivos ficam fora | v5.104.2 (11/10/2026), muito ativo | Bom como **camada de rede/cache**, fraco como **fonte de verdade** offline |
| **WatermelonDB** | **Não** (nativo, sem config plugin oficial) | Não | **Alto**: protocolo pull/push com `lastPulledAt`, transacional | Fora do escopo da lib | Última versão estável 0.28.0 (07/04/2025). Sem commit no master desde 11/08/2025. Issue "Has WatermelonDB been abandoned?" aberta | **Descartar** |
| **Legend-State v3 (sync)** | Sim, persistindo via expo-sqlite/AsyncStorage | Não (plugin CRUD/fetch próprio) | Médio: `list`/`create`/`update` + `updatedAt` | Fora do escopo | v3 ainda **beta** (3.0.0-beta.48, 12/07/2026). `latest` no npm ainda é 2.1.15 | Arriscado (beta, curva de aprendizado) |
| **PowerSync** | Só com o adapter JS `@powersync/adapter-sql-js`. O adapter nativo exige dev build | **Sim**: PowerSync Service (Cloud ou self-host) + replicação lógica do Postgres | Médio/alto: `uploadData` → nossa API + config de Sync Streams + JWT | **Sim**, attachment queue com `ExpoFileSystemStorageAdapter` | Muito ativo (`@powersync/react-native` 2.3.1) | Tecnicamente o mais completo, mas é **mais uma peça de infra** |
| **ElectricSQL** | — | **Sim**: Electric sync service | — | — | Ativo, mas "Electric does not do write-path sync" | **Não atende** (só leitura) |
| **TinyBase** | Sim ("works seamlessly with Expo Go") | Precisa de servidor WebSocket (`WsServer`) para sincronizar | Alto para integrar com a nossa API REST/Drizzle | Fora do escopo | Ativo (10.0.1) | Não encaixa (modelo CRDT/store, não REST) |
| **TanStack DB + `@tanstack/offline-transactions`** | Sim, com adapter AsyncStorage escrito por nós | Não | Médio (`idempotencyKey`) | Fora do escopo | `@tanstack/db` 0.13.0 (pré-1.0) | Promissor, mas imaturo para o prazo |

---

## 1. expo-sqlite + Drizzle ORM no device + fila *outbox* própria

### 1.1 expo-sqlite (SDK 57)

- **Disponibilidade:** a página de referência (v57.0.0) lista `expo-go` entre as plataformas. Ou seja, **funciona no Expo Go**, exceto o SQLCipher, que exige `useSQLCipher` + `npx expo prebuild`. <https://docs.expo.dev/versions/latest/sdk/sqlite/>
- **Versão:** `expo-sqlite` 57.0.4 no `latest`/`sdk-57` do npm (`npm view expo-sqlite dist-tags`, 2026-10-12).
- **API atual:**
  - `openDatabaseAsync` / `openDatabaseSync`;
  - `execAsync` (sem escape de parâmetros), `runAsync` (retorna `changes` e `lastInsertRowId`), `getFirstAsync` / `getAllAsync` / `getEachAsync`;
  - prepared statements com `prepareAsync` → `executeAsync` → `finalizeAsync`;
  - transações com `withTransactionAsync` e `withExclusiveTransactionAsync`. Esta última restringe a transação às queries do objeto `txn`, o que importa para não misturar escritas concorrentes na fila;
  - integração com React: `SQLiteProvider` / `useSQLiteContext`;
  - migrações "na mão" via `PRAGMA user_version` no `onInit` (não existe API dedicada de migração).

  Fonte: <https://docs.expo.dev/versions/latest/sdk/sqlite/>
- **Extras úteis:**
  - `expo-sqlite/kv-store`, um **substituto drop-in do AsyncStorage** com `getItemSync`/`setItemSync`. Serve para guardar token, `lastSyncAt` e preferências sem adicionar `@react-native-async-storage/async-storage`;
  - Sessions/changesets do SQLite (`createSessionAsync`, `createChangesetAsync`), que não precisamos no MVP.

  Fonte: <https://docs.expo.dev/versions/latest/sdk/sqlite/>

### 1.2 Drizzle ORM com o driver `expo-sqlite`

- **Driver:** `drizzle()` importado de `drizzle-orm/expo-sqlite`, recebendo `openDatabaseSync("db.db")`. <https://orm.drizzle.team/docs/connect-expo-sqlite>
- **Migrações no device:** "Expo / React Native requires you to have SQL migrations bundled into the app". O passo a passo:
  - `babel-plugin-inline-import` com `extensions: [".sql"]`;
  - `config.resolver.sourceExts.push('sql')` no `metro.config.js`;
  - `drizzle.config.ts` com `dialect: 'sqlite'` e `driver: 'expo'`;
  - `npx drizzle-kit generate`;
  - em runtime, `useMigrations(db, migrations)` de `drizzle-orm/expo-sqlite/migrator`, que devolve `success`/`error`.

  Fonte: <https://orm.drizzle.team/docs/connect-expo-sqlite>
- **Live queries:** abrir com `openDatabaseSync('db.db', { enableChangeListener: true })` e usar `useLiveQuery(db.select().from(...))`. O componente re-renderiza quando os dados mudam. <https://orm.drizzle.team/docs/connect-expo-sqlite>
- **Inspeção no device:** existe o plugin de dev tools "Drizzle Studio" para Expo (`drizzle-studio-expo`). <https://orm.drizzle.team/docs/connect-expo-sqlite>
- **Atenção à versão:** a página atual do Drizzle manda instalar `drizzle-orm@rc` / `drizzle-kit@rc` e `expo-sqlite@next`. Hoje o `latest` do npm é **drizzle-orm 0.45.4** (08/10/2026) e **drizzle-kit 0.31.11**, e a v1 está em `1.0.0-rc.4`/`rc.5` (pré-release no GitHub). O driver `expo-sqlite`, inclusive o `migrator.ts`, existe na tag estável `0.45.4`. Conferido via `gh api repos/drizzle-team/drizzle-orm/contents/drizzle-orm/src/expo-sqlite?ref=0.45.4` e <https://github.com/drizzle-team/drizzle-orm/releases>.
  - **Decisão a tomar:** fixar a mesma versão do Drizzle na API e no app (de preferência a estável 0.45.x) e **não** usar `expo-sqlite@next`, que é a linha do SDK 58 (`next` = 58.0.11). Use `npx expo install expo-sqlite`.
- **Ganho para a equipe:** a API já usa Drizzle. Os tipos e a forma de escrever o schema são os mesmos dos dois lados, embora os schemas sejam **diferentes** (SQLite no device, Postgres no servidor).
- **Licença:** Apache-2.0 (`gh api repos/drizzle-team/drizzle-orm`).

### 1.3 Padrão *outbox* (o que teríamos que escrever)

Nem o expo-sqlite nem o Drizzle trazem sync. A doc do Expo diz que para local-first com expo-sqlite você "will need to combine it with other tools or build your own" (<https://docs.expo.dev/guides/local-first/>). O desenho mínimo que atende RN05/RNF01:

1. **Tabelas de domínio locais** (`visita`, `checkin`, `auditoria`, `auditoria_item`, `foto`, `pedido`, `pedido_item`) com **PK UUID gerada no device** via `Crypto.randomUUID()` do `expo-crypto`. Ele gera UUID v4 (RFC 4122) e está "Included in Expo Go" (<https://docs.expo.dev/versions/latest/sdk/crypto/>). O mesmo ID é usado no Postgres, então não há remapeamento de IDs.
2. **Tabela `outbox`**, preenchida **na mesma transação** da escrita de domínio (`withExclusiveTransactionAsync` / `db.transaction`):
   - `seq INTEGER PRIMARY KEY AUTOINCREMENT`: ordem total local, que vale mais que o relógio;
   - `op_id` (UUID): **chave de idempotência**;
   - `tipo` (`CHECKIN`, `AUDITORIA`, `PEDIDO`, `CHECKOUT`, `FOTO`), `entidade_id`, `payload` JSON;
   - `ocorrido_em`: timestamp do momento da ação, exigido pelo RN05;
   - `status` (`pendente` / `enviando` / `erro` / `ok`), `tentativas`, `ultimo_erro`.
3. **Processador da fila:**
   - lê `WHERE status != 'ok' ORDER BY seq` e envia **um por vez**;
   - só avança quando recebe 2xx;
   - para no primeiro erro de rede (*head-of-line blocking* intencional), para que um pedido não chegue antes do check-in da visita;
   - erros 4xx de validação vão para a tela de "pendências com erro" e não ficam em retry infinito.
4. **Gatilhos de envio:**
   - `Network.addNetworkStateListener` do `expo-network`, que está "Included in Expo Go" (<https://docs.expo.dev/versions/latest/sdk/network/>);
   - app voltando para foreground (`AppState`);
   - botão "Sincronizar agora".
   - Opcional: `expo-background-task` ("Included in Expo Go"), mas sem garantia de horário. No Android o intervalo mínimo é 15 min (WorkManager), e a task só roda com bateria e rede (<https://docs.expo.dev/versions/latest/sdk/background-task/>). Serve como reforço, não como mecanismo principal.
5. **Pull (servidor → device):** um `GET /sync/pull?since=<cursor>` para rota do dia, clientes, catálogo de produtos e materiais de PDV. Para o MVP, esses dados são basicamente **somente leitura no app**, então o pull pode ser "baixar o snapshot do dia" em vez de um diff incremental.

**Expo Go / dev build:** tudo acima (expo-sqlite, expo-file-system, expo-network, expo-crypto, expo-background-task) está marcado como "Included in Expo Go" nas páginas de referência do SDK 57. O Drizzle é JS puro, só com config de Babel/Metro. Dá para desenvolver no Expo Go e gerar o APK no fim.

---

## 2. TanStack Query: persistência e mutations como fila

- **Versões:** `@tanstack/react-query`, `@tanstack/react-query-persist-client` e `@tanstack/query-async-storage-persister` estão em **5.104.2** (publicadas em 11/10/2026, conforme `npm view`).
- **Online/offline no RN:** a doc oficial liga o `onlineManager` ao NetInfo (`setOnline(!!state.isConnected)`) **ou** ao `expo-network` (`Network.addNetworkStateListener` + `getNetworkStateAsync` no início). Para foco, usa `AppState` + `focusManager.setFocused`. <https://tanstack.com/query/latest/docs/framework/react/react-native>
- **Mutations offline:** com o `networkMode` padrão (`online`), "Queries and Mutations will not fire unless you have network connection". Elas ficam pausadas e são retentadas na mesma ordem ao reconectar. <https://tanstack.com/query/latest/docs/framework/react/guides/network-mode> · <https://tanstack.com/query/latest/docs/framework/react/guides/mutations>
- **Persistência das mutations:**
  - Por padrão, só mutations **pausadas** são desidratadas: `defaultShouldDehydrateMutation(mutation) { return mutation.state.isPaused }` (<https://github.com/TanStack/query/blob/main/packages/query-core/src/hydration.ts>).
  - Funções não são serializáveis, então é obrigatório registrar `queryClient.setMutationDefaults([...], { mutationFn })` e chamar `queryClient.resumePausedMutations()` no `onSuccess` do `PersistQueryClientProvider`. Sem isso, o resultado é o erro "No mutationFn found". <https://tanstack.com/query/latest/docs/framework/react/guides/mutations>
- **Ordenação:** "All mutations with the same `scope.id` will run in serial". Usar um único `scope: { id: 'sync' }` dá FIFO para RN05. <https://tanstack.com/query/latest/docs/framework/react/guides/mutations>
- **Limites do persister:**
  - `maxAge` padrão de **24 h**. Um cache mais velho é descartado, o que inclui mutations pendentes se não aumentarmos esse valor;
  - `buster` invalida tudo a cada mudança de versão;
  - a gravação é *throttled* (no máximo 1 vez/s).

  Fonte: <https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient>
- **Avaliação para o AXIS:**
  - **(a)** O estado fica num **blob serializado** (AsyncStorage), não em tabelas consultáveis. A UI do app ("pedidos de hoje", "visitas pendentes") teria que ler do cache de queries mais os `variables` das mutations pendentes, o que fica frágil para "armazenamento local estruturado" (R5).
  - **(b)** O throttle de 1 s e o `maxAge`/`buster` criam janelas em que uma ação pode se perder se o app for morto. Uma transação SQLite não tem esse problema.
  - **(c)** Fotos não cabem nesse modelo.
  - Conclusão: **usar TanStack Query no app para leitura/cache e para disparar o sync é ótimo** (o time já conhece pelo web), mas a **fonte de verdade offline deve ser o SQLite**.
- **Alternativa do mesmo ecossistema:** `@tanstack/offline-transactions` implementa um **outbox durável** para o TanStack DB:
  - envia um `idempotencyKey` estável por tentativa;
  - "queued transactions continue in creation order";
  - no RN exige escrever um adapter de storage (exemplo com AsyncStorage).

  Ainda é pré-1.0 no núcleo (`@tanstack/db` 0.13.0). <https://tanstack.com/db/latest/docs/guides/offline-transactions> Vale como **referência de desenho**, não como dependência para este prazo.

---

## 3. Fotos offline (vale para qualquer opção)

Nenhuma das libs de dados, exceto o PowerSync, guarda arquivos. O padrão é:

1. A foto é capturada (`expo-camera` / `expo-image-picker`) e **copiada para `Paths.document`**, porque `Paths.cache` "can be deleted by the system". Para isso servem `File`, `Directory`, `file.copy()` e `file.move()` do `expo-file-system`. <https://docs.expo.dev/versions/latest/sdk/filesystem/>
2. Grava-se a linha `foto` (UUID, `auditoria_id`, `uri_local`, `status_upload`) e o item de outbox `FOTO` **na mesma transação** da auditoria.
3. O upload usa a API nova:
   - `File.upload(url, options)` ou `file.createUploadTask(url, options)` com progresso e `cancel()`;
   - ou `expo/fetch` com `body: file` / `FormData`.

   `FileSystem.uploadAsync` está no `expo-file-system/legacy` e marcado como deprecado. **Não usar.** <https://docs.expo.dev/versions/latest/sdk/filesystem/>
4. **Ordem sugerida:** fotos sobem antes do `POST /auditorias` que as referencia, ou a auditoria sobe com os IDs das fotos e o servidor aceita foto "pendente". Isso precisa ser fechado (veja os pontos da decisão).
5. A sessão `background` de upload é **só iOS**. No Android a opção é ignorada, e o `UploadTask` não é restaurado se o app for morto (<https://docs.expo.dev/versions/latest/sdk/filesystem/>). Logo, o retry tem que sair da **nossa** fila no SQLite.
6. Depois do `2xx`, a foto local pode ser apagada ou movida para o cache.
7. Comprimir antes (ex.: ~1280px JPEG) reduz tempo e falhas de upload. A estimativa de volume está em [hospedagem-gratuita.md](./hospedagem-gratuita.md).

---

## 4. WatermelonDB

- **Versão/manutenção:**
  - `@nozbe/watermelondb` `latest` = **0.28.0** (07/04/2025) e `next` = 0.28.1-0 (24/07/2025), conforme `npm view @nozbe/watermelondb time`;
  - último commit no `master`: **11/08/2025** (`gh api repos/Nozbe/WatermelonDB/commits`);
  - o CHANGELOG para em "0.28 - 2025-04-07" (<https://github.com/Nozbe/WatermelonDB/blob/master/CHANGELOG.md>);
  - issue aberta "Has WatermelonDB been abandoned?" (<https://github.com/Nozbe/WatermelonDB/issues/1963>), em que um contribuidor externo anuncia um **fork/reescrita** em Nitro Modules "to ... support the New architecture and add Expo and bare autolinking support" (comentário de 14/08/2026).
- **Expo / New Architecture:**
  - A página de instalação **não menciona Expo**. Ela cobre RN bare, com JSI configurado manualmente em Gradle/`MainApplication` e Babel decorators `legacy: true`. <https://watermelondb.dev/docs/Installation>
  - Bridgeless/New Arch está em aberto desde 2024: <https://github.com/Nozbe/WatermelonDB/issues/1769>, com 82 comentários e relatos de `Cannot read property 'initializeJSI' of null` com Expo 54 (01/12/2025). Ver também <https://github.com/Nozbe/WatermelonDB/issues/1969> (06/2026, sem resposta oficial) e "Support Expo" <https://github.com/Nozbe/WatermelonDB/issues/1909>.
  - **Não roda no Expo Go** (módulo nativo sem config plugin oficial). O SDK 57 é New Arch obrigatória (<https://docs.expo.dev/guides/new-architecture/>).
- **Protocolo de sync:** é o mais bem especificado da lista, e serve como **referência de contrato** mesmo sem a lib (<https://watermelondb.dev/docs/Sync/Backend>):
  - pull com `lastPulledAt` → `{ changes: { tabela: { created, updated, deleted } }, timestamp }`;
  - push "MUST be fully transactional";
  - criar um ID que já existe deve **atualizar** (idempotência);
  - deletar um inexistente é ignorado;
  - conflito (registro alterado no servidor após `lastPulledAt`) aborta o push e força novo pull;
  - `last_modified` gerado no servidor (nunca confiar no do cliente);
  - soft-delete ou tabela de deleções.
- **Veredito:** **descartar** para o AXIS. O risco de build com New Arch no SDK 57 e a falta de manutenção não cabem em 7 semanas.

---

## 5. Legend-State (sync plugins)

- **Versões:** o `latest` no npm ainda é **2.1.15**. O sync engine documentado é a **v3**, publicada como **3.0.0-beta.48** (12/07/2026), conforme `npm view @legendapp/state`. A própria doc v3 é marcada "Beta version". <https://legendapp.com/open-source/state/v3/sync/persist-sync/>
- **O que oferece:**
  - persistência local em React Native via **Expo SQLite**, AsyncStorage ou MMKV;
  - "any changes made while offline are persisted between sessions to be retried whenever connected" (`retrySync: true`);
  - sync incremental com `changesSince: 'last-sync'` + `fieldUpdatedAt`;
  - plugin genérico `syncedCrud` (`list`/`create`/`update`) e plugins para Supabase, Keel, Fetch e TanStack Query.

  Fonte: <https://legendapp.com/open-source/state/v3/sync/persist-sync/>
- **Expo Go:** os backends de persistência citados (expo-sqlite / AsyncStorage) estão no Expo Go, e a lib é JS. A doc do Expo cita Legend-State como opção que "works with Expo and React Native via `react-native-async-storage`". <https://docs.expo.dev/guides/local-first/>
- **Backend:** endpoints CRUD por coleção + coluna `updatedAt` para diffs.
- **Ordenação:** a doc não descreve garantia de ordem **entre coleções** (check-in antes de pedido), que é o centro do RN05. Seria preciso validar ou encaixar uma fila própria por cima.
- **Licença:** MIT (`gh api repos/LegendApp/legend-state`).
- **Veredito:** possível, mas é **beta** e adiciona um paradigma de estado novo (observables) para a equipe. Não compensa no prazo.

---

## 6. PowerSync

- **Como funciona:**
  - O cliente tem um SQLite local. O SDK "places every write to the SQLite database in an upload queue". Implementamos `uploadData`, que lê `getNextCrudTransaction()`, manda os PUT/PATCH/DELETE para **a nossa API** e chama `transaction.complete()`.
  - A leitura (servidor → device) vem do **PowerSync Service**, que replica o Postgres.
  - `fetchCredentials` devolve endpoint + JWT.

  Fonte: <https://docs.powersync.com/client-sdk-references/react-native-and-expo>
- **Expo Go:** "Our native database adapter is not compatible with Expo Go's sandbox environment". No Expo Go dá para usar o adapter JS `@powersync/adapter-sql-js`. O adapter nativo (`@op-engineering/op-sqlite` ≥ 1.17.0) **exige development build**. <https://docs.powersync.com/client-sdk-references/react-native-and-expo>
- **Infra exigida:**
  - Postgres ≥ 11 com **`wal_level = logical`** (requer restart), role com `REPLICATION`, publication chamada exatamente `powersync`;
  - "Some serverless Postgres providers don't support logical replication".

  Fonte: <https://docs.powersync.com/installation/database-setup>. **Isso conflita com escolhas de Postgres gratuito da issue #23**, então teria que ser checado provedor a provedor.
- **Custo/licença:**
  - Cloud Free: 2 GB sincronizados/mês, 500 MB hospedados, 50 clientes simultâneos, mas "Free projects are deactivated after 1 week of inactivity" (a página também fala em 2 semanas). Pro a partir de US$ 49/mês. <https://www.powersync.com/pricing>
  - Self-host "Open Edition": o serviço é **FSL-1.1-ALv2** (Functional Source License, que vira Apache 2.0 no futuro), conforme o `LICENSE` de <https://github.com/powersync-ja/powersync-service>. Os SDKs cliente são Apache-2.0 (<https://github.com/powersync-ja/powersync-js>).
- **Fotos:**
  - Tem **attachment queue** embutido no `@powersync/react-native`, com estados `QUEUED_UPLOAD` / `SYNCED`, sobrevive a restart e usa `ExpoFileSystemStorageAdapter`;
  - o pacote `@powersync/attachments` antigo está deprecado.

  Fonte: <https://docs.powersync.com/usage/use-case-examples/attachments-files>
- **Drizzle:** existe `@powersync/drizzle-driver` 0.8.0 (`npm view`).
- **Manutenção:** muito ativa. `@powersync/react-native` 2.3.1 é de 01/10/2026, e o repo teve push em 12/10/2026.
- **Veredito:** é a solução "de prateleira" mais completa (fila de upload + fotos + pull incremental). Para nós, porém, acrescenta **um serviço a mais para hospedar** (ou uma conta cloud que desativa por inatividade), **replicação lógica no Postgres** e **dev build**. O ganho não paga o custo em 7 semanas com 3 pessoas, já que o pull do MVP é praticamente somente leitura.

---

## 7. ElectricSQL

- Domínio novo: `electric-sql.com` redireciona para `electric.ax`.
- "**Electric does not do write-path sync.**" A doc lista padrões de escrita (online writes, optimistic state, shared persistent optimistic state, through-the-database com PGlite) que ficam por conta da aplicação. <https://electric.ax/docs/guides/writes>
- No Expo, o cliente `@electric-sql/react` faz streaming de *shapes*, mas "PGlite doesn't _yet_ work in React Native", ou seja, não há persistência local pronta no RN. <https://electric.ax/docs/integrations/expo>
- Exige rodar o serviço Electric (Cloud: leituras grátis, escritas pagas, uso < US$ 5/mês isento; <https://electric.ax/pricing>). Licença do repo: Apache-2.0 (`gh api repos/electric-sql/electric`).
- **Veredito:** **não atende**. Resolve justamente a parte que precisamos menos (leitura) e não resolve a fila offline de escrita.

---

## 8. TinyBase e outros

- **TinyBase:**
  - Versão 10.0.1 (24/09/2026), licença MIT;
  - "TinyBase works seamlessly with Expo Go" e usa expo-sqlite no device (<https://docs.expo.dev/guides/local-first/>); tem `ExpoSqlitePersister` e também `PgPersister`/`PostgresPersister` (<https://tinybase.org/guides/persistence/database-persistence/>);
  - o sync é via `MergeableStore` (com metadados para reconciliar conflitos) e **WebSocket** (`WsSynchronizer` + `WsServer`), não via REST (<https://tinybase.org/guides/synchronization/> · <https://tinybase.org/guides/synchronization/using-a-synchronizer/>).
  - Teríamos que rodar um `WsServer` ao lado da API Fastify e mapear o store para as tabelas Drizzle. **Não encaixa** no nosso backend REST nem na exigência de ordem do RN05.
- **Outros citados pela doc do Expo** (<https://docs.expo.dev/guides/local-first/>):
  - LiveStore, Jazz, Instant, RxDB (adapter sobre expo-sqlite), Turso (offline sync com expo-sqlite), Prisma (RN em "early access").
  - Todos trazem modelo de dados e/ou backend próprio, o que não cabe para uma equipe que já tem Fastify + Drizzle + Postgres e 7 semanas.

---

## 9. Contrato mínimo da API (independe da opção)

O que o backend Fastify + Drizzle precisa ter para qualquer fila offline funcionar:

1. **IDs gerados no cliente:** PK `uuid` nas tabelas que o app cria (`checkin`, `auditoria`, `foto`, `pedido`, `pedido_item`, `checkout`). O servidor aceita o ID enviado.
2. **Idempotência:**
   - inserção com `INSERT ... ON CONFLICT (id) DO NOTHING` (<https://www.postgresql.org/docs/current/sql-insert.html>), que no Drizzle é `.onConflictDoNothing()` (<https://orm.drizzle.team/docs/insert>);
   - resposta **200 com o recurso existente** quando é repetição, nunca 409 (é a mesma regra do push do WatermelonDB, "If a created record's ID already exists, update it rather than erroring", <https://watermelondb.dev/docs/Sync/Backend>);
   - opcionalmente, header `Idempotency-Key` com o `op_id` da outbox. Observação: o draft IETF está **expirado**, versão 07 de 15/10/2025 (<https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/>), então é convenção, não padrão.
3. **Dois timestamps:** `ocorrido_em` (enviado pelo device, exigido pelo RN05) e `recebido_em` (servidor). O relógio do celular pode estar errado, por isso a **ordem de envio** deve vir do `seq` local e não do relógio. Para o check-in, o `LocationObject` do `expo-location` traz o `timestamp` da leitura de GPS (<https://docs.expo.dev/versions/latest/sdk/location/>).
4. **Validação de sequência no servidor:** rejeitar (4xx, sem retry) um pedido sem check-in aberto para a visita, ou aceitar e marcar como inconsistente. Isso precisa ser decidido.
5. **Upload de foto** idempotente por `foto.id` (o PUT para o mesmo ID sobrescreve ou é ignorado).
6. **Pull:** `GET /sync/pull` (ou `GET /rota-do-dia`) com tudo que o vendedor precisa offline no dia.

---

## Recomendação

**expo-sqlite + Drizzle (driver `expo-sqlite`) como fonte de verdade local, com uma tabela `outbox` própria processada em série (FIFO por `seq`), fotos em `expo-file-system` (`Paths.document`) com itens na mesma outbox, e endpoints idempotentes com UUID gerado no cliente na API Fastify.** O TanStack Query entra no app só como cache de leitura (rota, clientes, catálogo) e para o `onlineManager`, ligado ao `expo-network`, disparar o processador da fila. Ele **não** é a fila.

Por quê:

- **Atende RN05 diretamente.** A ordem é a do `seq` gravado na mesma transação da ação, e o processador é serial e para no erro. Check-in → auditoria → pedido → check-out sai na ordem certa por construção, sem depender de relógio nem de comportamento de lib.
- **Atende RNF01/R5 sem ambiguidade.** As tabelas são relacionais e consultáveis offline, a escrita é atômica, e não há `maxAge` de 24 h nem throttle de persistência.
- **Funciona no Expo Go.** Todas as peças estão "Included in Expo Go" no SDK 57: dá para desenvolver rápido e gerar o APK no fim. Não há dependência nativa fora do SDK, então o risco com a New Arch obrigatória é baixo.
- **Zero infra nova.** Não há serviço de sync para hospedar nem replicação lógica no Postgres, que é compatível com qualquer Postgres gratuito da issue #23.
- **Reaproveita o que a equipe já sabe.** Drizzle já está na API, e TanStack Query já está no web.
- **O código próprio é pequeno e sob controle:** ~1 schema local, 1 tabela outbox, 1 processador (~150–300 linhas) e 1 tela de pendências. O protocolo do WatermelonDB serve de checklist para o backend.

Plano de corte para o beta (06/11): (1) outbox + check-in/pedido offline; (2) fotos na fila; (3) pull do dia; (4) tela de pendências/erros. `expo-background-task` e o sync incremental (diff) ficam para depois do beta.

**Plano B:** se a fila caseira travar até ~25/10, o fallback com menor custo de troca é PowerSync (mesmo SQLite + `@powersync/drizzle-driver` + attachment queue), aceitando dev build e o serviço extra. WatermelonDB e ElectricSQL não são plano B.

## Pontos que a decisão "Estratégia de sync offline" precisa fechar

1. **Fonte de verdade local:** confirmar expo-sqlite + Drizzle (e qual versão do Drizzle: estável 0.45.x vs v1 RC), igual na API e no app.
2. **Granularidade da outbox:** um item por **ação de negócio** (`CHECKIN`, `AUDITORIA` completa, `PEDIDO` completo, `CHECKOUT`, `FOTO`) ou por linha de tabela. A recomendação é por ação de negócio, com um endpoint por tipo.
3. **Política de erro:** o que é retentável (rede, 5xx) e o que vai para "pendência com erro" (4xx). Também se um item com erro **bloqueia** os seguintes da mesma visita ou de toda a fila.
4. **Fotos × auditoria:** a foto sobe antes da auditoria ou a auditoria aceita fotos "pendentes"? Também é preciso definir o formato (multipart vs binário), a compressão e o destino (ligado à issue #23).
5. **Contrato de idempotência:** UUID no corpo + `ON CONFLICT DO NOTHING` (e resposta 200) vs header `Idempotency-Key` com tabela de chaves.
6. **Timestamps e relógio:** campos `ocorrido_em` / `recebido_em`, o que o painel web mostra, e o que fazer quando `ocorrido_em` vem no futuro ou muito no passado.
7. **Validação de sequência no servidor:** o que acontece com um pedido cujo check-in foi rejeitado (ex.: GPS fora do raio).
8. **Escopo do pull:** quais dados o app baixa (rota do dia, clientes da rota, catálogo, materiais de PDV), quando (login / início do dia / ao reconectar) e se é snapshot ou incremental.
9. **Gatilhos de sync:** reconexão (`expo-network`), foreground, botão manual. Também se `expo-background-task` entra no MVP.
10. **Conflitos:** confirmar que o app **não edita** dados mestres (clientes, produtos), o que elimina conflito bidirecional no MVP. Se editar, definir *last-write-wins* por `updated_at` do servidor.
11. **Autenticação offline:** o token expira enquanto há fila pendente? É preciso definir refresh e o comportamento ao reabrir o app sem rede.
12. **Limpeza e migração local:** quando apagar itens `ok` e fotos já enviadas, e como tratar migração de schema local com fila pendente (rodar `useMigrations` só depois de esvaziar a fila?).
