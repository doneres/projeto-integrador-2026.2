# Roteiro de demonstração — AXIS

Roteiro para a banca (07–11/12) e para o ensaio de uma semana antes. Liga cada cenário aos dados que o seed demo planta (`pnpm --filter @axis/api db:seed --profile=demo`), para ensaiar sem improviso. Decisões de origem: spec #52 (seed e "tempo real") e #27 e [ADR 0002](../adr/0002-app-local-first-com-outbox.md) (offline); a regra "o servidor vence nos dados mestres" está na resolução do #27, em "Erros, bloqueio e conflito".

> Os passos descrevem o comportamento decidido nos specs. Alguns dependem das ondas de Check-in, Offline e Pedido do app, que entram em tickets próprios: no ensaio, marque o que ainda não funciona e não leve esse cenário à banca sem tê-lo visto rodar uma vez em Android real.

## 1. Contas

Todas as contas de um perfil têm a mesma senha, que vem do gerenciador de senhas do grupo (nunca do repositório). A tabela completa, com o que cada uma tem, está no [README da API](../../apps/api/README.md#seed-e-reset); o [README do app](../../apps/mobile/README.md#contas-do-seed) repete a lista para quem só abre o app. O app só aceita Vendedores; o painel só aceita a gestão.

| Quem | E-mail | Matrícula | Onde entra | Papel no roteiro |
|---|---|---|---|---|
| Maria Souza (Coordenadora, Equipe A) | `gestor@axis.example` | `1001` | painel | aprova Prospecções, inativa Cliente, vê as Flags de auditoria |
| Carlos Modelo (Coordenador, Equipe B) | `coordenador.b@axis.example` | `1002` | painel | Equipe B; mostra que cada Coordenador vê só a sua Equipe |
| Diretor | `diretor@axis.example` | `3001` | painel | consolidado, Metas e Score |
| Administrador | `administrador@axis.example` | `4001` | painel | fora do roteiro (contas e Parâmetros) |
| Bruno Exemplo (Vendedor **showcase**, Equipe A) | `vendedor@axis.example` | `2001` | app | rota de hoje em andamento; cenário 4 |
| Ana Exemplo (Vendedora de teste, Equipe A) | `vendedor.a2@axis.example` | `2002` | app | conta do celular nos cenários 1, 2, 3 e 5 |
| Caio Exemplo (Equipe A) | `vendedor.a3@axis.example` | `2003` | app | reserva |
| Lia, Davi e Rita Modelo (Equipe B) | `vendedor.b1@axis.example`, `vendedor.b2@axis.example`, `vendedor.b3@axis.example` | `2004`, `2005`, `2006` | app | reservas (e testadores) |
| Otávio Exemplo (Vendedor desativado) | `vendedor.desativado@axis.example` | `2099` | não entra | mostra que o acesso cai na hora |

Os cinco Vendedores de teste (`2002` a `2006`) nascem com a rota de hoje e a de amanhã **100 % Pendentes**; a primeira Visita é o **Cliente de demonstração** da Equipe deles. O Bruno (`2001`) é o showcase: duas Visitas Concluídas, uma Em andamento e o resto Pendente.

## 2. Antes de ensaiar ou apresentar

### Reset + seed (antes de cada rodada de testes com usuários, a de 09–13/11 e as que vierem, e antes de 07/12)

As rotas são geradas **relativas ao dia da execução** e não andam sozinhas, então o estado limpo se faz sempre no dia (ou na véspera, com a repetição da manhã abaixo).

1. Apure a coordenada do local da apresentação (seção 3) e junte as senhas do gerenciador de senhas.
2. No terminal de um integrante, aponte para a **URL direta (sem pooler)** do Neon e exporte as quatro senhas (`SEED_PASSWORD_*`), como em [Em production (Neon)](../../apps/api/README.md#em-production-neon). Se for usar a sala real, exporte também `SEED_DEMO_LATITUDE` e `SEED_DEMO_LONGITUDE` (as duas juntas).
3. `pnpm --filter @axis/api db:reset` recusa e mostra o host de destino. Confira o host e rode `pnpm --filter @axis/api db:reset --confirm=<host>`.
4. `pnpm --filter @axis/api db:seed --profile=demo`.
5. Confira: o login do `2002` no app mostra a rota de hoje com todas as Visitas Pendentes e o Cliente de demonstração em primeiro; a Maria vê 3 Prospecções Pendentes; o Diretor vê Metas e Scores; o painel mostra o dia do Bruno em andamento.
6. Feche o terminal, para não rodar outro comando contra o Neon sem querer.

**No dia da apresentação, de manhã**, rode só o passo 4 de novo (sem reset, com as variáveis do passo 2 no terminal). O seed só cria o que falta: a rota que era a de "amanhã" vira a de "hoje" e o Bruno volta a ter a dele em andamento, com os dias úteis novos no histórico. Quem já mexeu numa rota a mantém como está; para voltar ao zero, reset de novo.

Depois de cada rodada de ensaio, volte ao passo 3. Se algum cenário deixou um Cliente Inativo ou uma rota mexida, o reset também resolve.

### Esquentar a infra (10 min antes)

O Render Free dorme em 15 min e o Neon suspende em ~5 min sem uso. Abra `<URL da API>/health` (não toca o banco) e, em seguida, entre com uma conta no painel e outra no app: o login leva até 90 s com a API fria, e o app mostra "Acordando o servidor…". Faça isso **antes** de a banca estar olhando.

### Plano B: Docker Compose no notebook

Entrega a mesma demonstração do `production`, sem mudar o roteiro.

1. Notebook com Node 24, pnpm e Docker, na mesma rede do celular (ou o notebook como ponto de acesso do celular).
2. `pnpm install`, `pnpm db:up`, `cp apps/api/.env.example apps/api/.env` (valores de dev, nada secreto) e `pnpm dev:api` (a API escuta em `0.0.0.0:3000` e aplica as migrations).
3. `pnpm --filter @axis/api db:reset` e `pnpm --filter @axis/api db:seed --profile=demo` (em dev, sem confirmação; as senhas são as do `.env`). Se for usar a sala real, defina `SEED_DEMO_LATITUDE` e `SEED_DEMO_LONGITUDE` no `.env`.
4. Painel: `pnpm dev:web` com `apps/web/.env.development.local` em `VITE_USE_MOCKS=false` e `VITE_API_URL` vazio ([README do web](../../apps/web/README.md)).
5. App: no login, **toque longo no logo AXIS** e informe `http://<IP do notebook>:3000`. Libere a porta 3000 no firewall do notebook.
6. Confira o caminho inteiro uma vez, com o celular.

Risco a fechar no ensaio: um APK de release no Android 9 ou mais novo recusa `http://` por padrão (o `app.json` não habilita tráfego sem TLS). Se for o caso, habilite `usesCleartextTraffic` no build do APK do plano B ou use um túnel HTTPS para a API do notebook.

## 3. Check-in No Local: por que não dá para simular

A RN01 compara a posição do Vendedor com a do Cliente: até o raio dos Parâmetros do sistema (padrão **100 m**) é **No Local**; além disso é **Fora do Raio**, aceito só com justificativa e visto como Flag de auditoria pelo Coordenador e pelo Diretor. Nunca bloqueia por distância.

O que bloqueia é a posição **`mocked`**: no Android, `expo-location` avisa quando a coordenada vem de um app de localização falsa (e o emulador manda uma coordenada simulada). O Check-in é recusado nesse caso, e a regra não vai ser afrouxada para a demonstração. Daí:

- **Um Check-in No Local de verdade exige estar no ponto.** Use o **APK em Android real**, no local da apresentação.
- No iPhone com Expo Go o sinal `mocked` não existe: o Check-in passa como "não sinalizado". Serve para ensaiar a tela, não prova a RN01.
- A permissão de localização precisa ser a precisa, não a aproximada.

### Apontar o Cliente de demonstração para o local da apresentação

O Cliente de demonstração tem uma versão por Equipe, na mesma coordenada (padrão em Goiânia: `-16.6799, -49.255`). Para movê-lo para a sala:

1. Pegue a latitude e a longitude do ponto, onde o celular vai ficar (no Google Maps, botão direito no ponto e clique nos números). Prefira um lugar com vista para o céu, perto de uma janela: GPS dentro de prédio erra dezenas de metros.
2. Exporte `SEED_DEMO_LATITUDE` e `SEED_DEMO_LONGITUDE` (as duas) e rode o seed demo. A coordenada vale para o Cliente que já existe, sem reset.
3. As rotas já criadas **não** se reordenam (a ordem das paradas segue a distância do ponto antigo): para a ordem certa, defina as variáveis e rode `db:reset` antes do seed, como na seção 2.
4. No ensaio, no ponto, faça o Check-in e confira a distância mostrada. Se estiver perto do raio, a sala não serve: ajuste a coordenada ou escolha outro ponto. Teste também uma Visita Fora do Raio, para ver a Flag.

## 4. Cenários

Ordem sugerida na banca: **painel já aberto** (Maria, Dashboard e Rotas) e o celular com a Ana. A Ana serve aos cenários 1, 2, 3 e 5; o 4 usa o Bruno e, como o app guarda um usuário por vez, só começa com a fila da Ana vazia.

### Cenário 1: modo avião de ponta a ponta, com Check-in No Local

| | |
|---|---|
| **Conta** | Ana Exemplo (`2002`) no app; Maria (`1001`) no painel |
| **Cliente** | Cliente de demonstração Exemplo, a 1ª Visita da rota de hoje da Ana, no local da apresentação |
| **Dados semeados** | Rota de hoje 100 % Pendente; 1 Comodato ativo no Cliente; catálogo de 12 Produtos; raio de 100 m |

Passos:

1. Com rede, entre como Ana e toque em **Atualizar** (o snapshot da onda do offline traz rota de hoje e de amanhã, Clientes, Comodatos, Produtos, raio e Prospecções; hoje a API entrega rotas, Clientes, raio e Prospecções, e Comodatos e Produtos entram quando essas tabelas entrarem no snapshot). Veja "Rota atualizada às HH:mm".
2. Ligue o **modo avião**.
3. Abra a Visita 1 e faça o **Check-in**, no ponto: **No Local**.
4. Audite o Comodato. Item Avariado ou Necessita Manutenção exige Foto; Ausente exige justificativa; a Visita precisa de ao menos 1 Foto (RN03).
5. Emita um **Pedido** (use o Refrigerante Cola 2 L, que tem o preço reajustado, para o cenário 5) e faça o **Check-out** com Desfecho Venda Realizada.
6. Mostre a barra "Sem conexão" e as pendências. Desligue o modo avião.

Esperado:

- **App:** a fila envia em segundos; as pendências zeram e a Visita fica Concluída.
- **Painel:** em cerca de **um minuto** (segundos do envio + até 30 s do polling), no Dashboard a Visita realizada e o faturamento sobem, e em Rotas a Visita da Ana aparece Concluída, sem Flag.

### Cenário 2: Check-in Fora do Raio e Flag de auditoria

| | |
|---|---|
| **Conta** | Ana (`2002`) no app; Maria (`1001`) e o Diretor (`3001`) no painel |
| **Cliente** | A 2ª Visita da rota de hoje da Ana (e as seguintes) |
| **Dados semeados** | Depois do Cliente de demonstração, a rota segue por Clientes a **mais de 200 m** do ponto, do mais perto para o mais longe, para estar sempre além do raio; Flags históricas (~8 % dos Check-ins, com justificativa) |

Passos: com a Ana ainda no local da apresentação, abra a 2ª Visita e faça o Check-in. O app mostra Fora do Raio e pede a **justificativa**; sem ela, não segue.

Esperado:

- **App:** Visita Em andamento, Check-in marcado como Fora do Raio.
- **Painel:** em Rotas, a seção **"Flags de auditoria"** ganha o check-in fora do raio com a distância e a justificativa, em até 30 s depois de o servidor receber; o Diretor também vê. O Carlos (`1002`) **não** vê a Flag: é da Equipe A.

### Cenário 3: aprovação de Prospecção ao vivo

| | |
|---|---|
| **Conta** | Maria (`1001`), painel > Prospecções; Ana (`2002`) no app > "Minhas prospecções" |
| **Cliente** | As 3 Prospecções Pendentes de aprovação da Equipe A (cadastradas pelo Bruno, pela Ana e pelo Caio) |
| **Dados semeados** | 1 Prospecção Rejeitada da Ana, com o motivo "Fora da área atendida pela Equipe"; 2 já aprovadas no mês (uma do Bruno e uma do Davi); Metas do mês |

Passos:

1. No app, a Ana abre **Minhas prospecções**: uma **Pendente de aprovação** e uma **Rejeitada** (com o motivo). Prospecção não aparece em rota nem aceita Pedido (RN04).
2. No painel, a Maria abre Prospecções e **aprova** a da Ana. Em Clientes, o novo Cliente entra ativo na carteira.
3. A Ana reabre **Minhas prospecções** (a lista é lida ao abrir a tela; o botão Atualizar é o da rota): a Prospecção passa para **Aprovada**. A lista não se atualiza sozinha: o app não faz polling.
4. A Maria **rejeita** a do Caio com um motivo; o Caio vê o motivo na lista dele.

Esperado nas Metas: o realizado de **novos clientes** conta no mês da aprovação. Só o Bruno tem Meta de novos clientes (1); aprovar a Prospecção dele leva o realizado de 1 para 2, mas o Score dele já está no teto de 100 %. A Ana e o Caio não têm Meta nesse indicador, então a aprovação da Prospecção deles não mexe no Score (o indicador sem Meta fica fora da conta). Para mostrar a Meta andando, aprove a do Bruno com o Diretor em Metas.

### Cenário 4: "o servidor vence" depois de inativar um Cliente

| | |
|---|---|
| **Conta** | Bruno (`2001`) no app; Maria (`1001`) no painel |
| **Cliente** | A **5ª Visita** da rota de hoje do Bruno (Pendente, com 1 Comodato). A rota do showcase tem, em ordem, 3, 2, 1, 0, 1 e 1 Comodatos ativos; a 4ª não tem nenhum (caminho sem Auditoria) |
| **Dados semeados** | Rota de hoje do Bruno (2 Concluídas, 1 Em andamento, 3 Pendentes); catálogo de Produtos no snapshot |

Passos:

1. Com a fila da Ana vazia, entre como Bruno, com rede, e toque em **Atualizar**. Ligue o modo avião.
2. No painel, a Maria vai em Clientes e **inativa** o Cliente da 5ª Visita. (Clientes não fazem polling: a ação aparece na hora.)
3. Ainda offline, o Bruno faz Check-in, Auditoria, **Pedido** e Check-out nessa Visita.
4. Desligue o modo avião.

Esperado:

- **O servidor vence nos dados mestres:** o Pedido é recusado, porque o Cliente não está ativo (RN04; a API já responde `CLIENTE_NAO_ATIVO`). O item vira **Erro** nas pendências, com a mensagem, e **bloqueia os seguintes da mesma Visita**; as outras Visitas seguem. O que o Bruno registrou continua visível, marcado "não aceito pelo servidor", até ele **Descartar** (com confirmação) ou tentar de novo (falha de novo).
- **Painel:** nenhum faturamento novo da Visita.
- **A confirmar no ensaio:** o que o servidor aceita antes do Pedido (Check-in e Auditoria) depende da onda do offline; anote aqui o que vir.
- **Depois:** a Maria **reativa** o Cliente (o reset também o restaura).

O Cliente da 5ª Visita pode estar também na rota de outro Vendedor da Equipe A: se estiver, avise esse testador e reative o Cliente ao fim. Alternativa sem o Bruno: qualquer Visita Pendente de um Vendedor de teste serve (o Pedido é recusado do mesmo jeito), mas as paradas deles, fora o Cliente de demonstração, não têm Comodato. **Não** inative o Cliente de demonstração: a Equipe toda tem ele como 1ª Visita.

### Cenário 5: o Score muda depois de um Pedido

| | |
|---|---|
| **Conta** | Ana (`2002`) no app; Diretor (`3001`) no painel > Metas |
| **Cliente** | O do Pedido do cenário 1 |
| **Dados semeados** | Metas do mês derivadas do realizado, em quatro situações: Bruno acima de 100 %, **Ana em torno de 85 %**, Caio em torno de 60 %, Lia em torno de 35 %, o Davi sem Meta de novos clientes e a Rita sem Meta nenhuma neste mês; Metas do mês anterior; Produtos com o preço reajustado há 10 dias |

Passos:

1. **Antes do cenário 1**, anote o Score e o realizado de faturamento da Ana na tela de Metas do Diretor ("Score Comercial", pesos 50/30/20, teto de 100 % por indicador). Um Pedido grande (4 itens, 12 unidades) deixa a mudança mais visível.
2. Faça o cenário 1 (o Pedido sincroniza) e espere até 30 s.

Esperado:

- **Painel:** o faturamento e as visitas realizadas da Ana sobem, e o Score sobe junto (o de "novos clientes" fica fora da conta: ela não tem Meta nele). O número exato depende do dia da execução: compare com o anotado.
- **App:** quando a fila esvazia com sucesso, o app relê o Score e o realizado da Ana (`useSellerScore`, #72). A Tela de Metas do app ainda não existe: enquanto isso, a releitura é conferida pela API (`GET /v1/goals`) e pelo painel.
- **Preço congelado:** o Produto reajustado (Refrigerante Cola 2 L, R$ 9,49; era R$ 8,99) entra no Pedido novo pelo preço de hoje, e Pedidos de antes do reajuste (há mais de 10 dias) continuam com R$ 8,99.

## 5. "Tempo real" e o custo do polling

- **Tempo real = até 30 s depois de o servidor receber o dado; cerca de um minuto ponta a ponta** (envio da fila em segundos + até 30 s do polling do painel). Nunca diga "instantâneo". Visita feita offline só aparece quando o app do Vendedor sincronizar.
- O painel faz polling a cada 30 s **só com a aba visível**, e busca na hora ao voltar para a aba. Cadastros (Clientes, Prospecções, Produtos, Materiais, Usuários) não fazem polling.
- **Neon:** um painel visível mantém o banco acordado (autosuspend de ~5 min). A 0,25 CU, isso são ≈ 6 CU-h por dia de painel aberto, contra 100 CU-h por mês do plano grátis. Cabe nas janelas de teste e de apresentação; **não deixe o painel aberto por dias**. Feche as abas ao terminar o ensaio.
- Se o painel disser "sem atualizar desde HH:mm", a API caiu ou está fria: o último dado continua na tela e ele volta sozinho.

## 6. Se algo der errado

| Sintoma | O que fazer |
|---|---|
| Login lento ou "Acordando o servidor…" | API fria: espere (até 90 s) e faça o "Esquentar" antes da próxima vez |
| Check-in recusado no emulador ou com GPS falso | Esperado (RN01, `mocked`): use o APK em Android real |
| Check-in "Fora do Raio" dentro da sala | Coordenada do Cliente de demonstração fora do ponto: seção 3 |
| A rota de hoje do app está vazia ou velha | **Atualizar**; se o seed foi rodado em outro dia, rode o seed demo de novo |
| Fila com erro depois de um cenário | Descartar o item, ou reset + seed antes do próximo ensaio |
| Neon ou Render fora | Plano B (seção 2), com a URL trocada no toque longo do logo |
