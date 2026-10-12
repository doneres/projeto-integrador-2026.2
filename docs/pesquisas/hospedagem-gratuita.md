# Pesquisa: hospedagem gratuita da API, Postgres e fotos

> Issue: #23 · Alimenta a decisão "Infra e ambientes de dev e demo"
> Pesquisa feita em **2026-10-12**. Todas as fontes abaixo foram consultadas nessa data, salvo indicação. Planos gratuitos mudam com frequência: **reconfirmar os limites no dia em que a conta for criada**.

## Pergunta

Onde hospedar, **sem custo** (ou com free tier estável até dezembro/2026):

1. a API **Node.js + Fastify** containerizada com Docker;
2. o **PostgreSQL** acessado via DrizzleORM;
3. as **fotos** de auditoria de PDV enviadas pelo app mobile;
4. (brevemente) o **painel web React**;

com HTTPS, acessível pelo celular físico do vendedor (APK Android via Expo) e sem credenciais no repositório.

### Restrições do nosso cenário

- 3 estudantes, volume pequeno: demo + sessões de teste com ~5 usuários entre **09 e 13/11/2026**, apresentação final entre **07 e 11/12/2026**.
- O serviço precisa estar de pé de agora (outubro) até **pelo menos 11/12/2026**, ou seja, ~2 meses. Qualquer coisa que **expira em 30 dias** ou **pausa por inatividade** é um risco real.
- **HTTPS é obrigatório na prática:** apps Android com target API 28+ bloqueiam HTTP em texto puro por padrão ("Starting with Android 9 (API level 28), cleartext support is disabled by default.") — [Android Network Security Config](https://developer.android.com/privacy-and-security/security-config).
- Estimativa de volume de fotos: se o app comprimir para ~1280px/JPEG (~200–400 KB), 5 usuários × ~50 fotos ≈ 250 fotos ≈ **< 100 MB**. Qualquer free tier de armazenamento aguenta; o que diferencia é **cartão, expiração e forma de upload**. (Estimativa nossa, não de fonte.)

---

## 1. API (Node.js + Fastify em Docker)

| Opção | Free tier | Dorme? / cold start | Cartão? | Observações |
|---|---|---|---|---|
| **Render** (Free web service) | 750 instance-hours/mês por workspace; horas não usadas não acumulam; ao esgotar, serviços free ficam suspensos até o mês seguinte | Dorme após **15 min** sem tráfego; acordar "takes about one minute" | Não exigido para criar; só importa em excedente de banda/build | Suporta deploy via Dockerfile; subdomínio `onrender.com` com TLS gerenciado grátis; **disco local é perdido ao dormir**; sem disco persistente no free |
| **Koyeb** (Free Instance) | 1 instância free por organização: 512 MB RAM, 0,1 vCPU, 2 GB SSD; Frankfurt ou Washington | Escala a zero após **1 h** sem tráfego; "deep sleep" tem cold start de 1–5 s (o doc não especifica o tempo para a instância free) | FAQ: "We require a credit card to prevent fraud and abuse." | Sem volumes persistentes na instância free |
| **Railway** | Trial: US$ 5 únicos, válidos por 30 dias. Depois: plano Free com **US$ 1/mês** de crédito, 0,5 GB RAM, 1 projeto, 3 serviços | Não documentado para o plano Free | Trial: "No credit card required" | US$ 1/mês não sustenta um container 24/7: RAM custa US$ 10/GB/mês (0,5 GB ≈ US$ 5/mês). **Inviável até dezembro sem pagar** |
| **Fly.io** | **Não há free tier** para organizações novas: "New organizations don't have a free tier or a monthly free usage allowance." Trial de 2 h de máquina ou 7 dias | — | Exigido após o trial | Menor máquina (shared-cpu-1x 256 MB): US$ 2,19/30 dias. **Descartado** |
| **Google Cloud Run** | 2 M requisições, 180.000 vCPU-s, 360.000 GiB-s/mês | Escala a zero (cold start curto) | **Exige billing account** com cartão | Generoso, mas exige cartão e configuração GCP — complexidade desproporcional |

Fontes:
- Render free: <https://render.com/docs/free> — 15 min, ~1 min de cold start, 750 h, filesystem perdido ao dormir, sem disco persistente, portas SMTP bloqueadas, suspensão por banda sem forma de pagamento.
- Render Docker: <https://render.com/docs/docker> ("Render fully supports Docker-based deploys"). A página de free tier não diz explicitamente "Docker", mas lista web services como elegíveis; **confirmar no dashboard ao escolher o instance type Free com runtime Docker**.
- Render web services (subdomínio, TLS, bind em `0.0.0.0`, `PORT` padrão 10000): <https://render.com/docs/web-services>
- Render regiões (Oregon, Ohio, Virginia, Frankfurt, Singapore): <https://render.com/docs/regions>
- Koyeb instâncias: <https://www.koyeb.com/docs/reference/instances> · scale-to-zero: <https://www.koyeb.com/docs/run-and-scale/scale-to-zero> · cartão: <https://www.koyeb.com/docs/faqs/pricing>
- Railway: <https://railway.com/pricing> · <https://docs.railway.com/reference/pricing/free-trial> · preços unitários: <https://docs.railway.com/reference/pricing/plans>
- Fly.io: <https://docs.fly.io/about/pricing>
- Cloud Run / GCP Free Tier: <https://docs.cloud.google.com/free/docs/free-cloud-features> ("A Google Cloud billing account is required to access the Google Cloud Free Tier.")

### Pegadinhas da API

- **Cold start no app mobile (Render):** depois de 15 min sem requisição, a primeira chamada leva ~1 min. Com o timeout padrão de `fetch`/axios no app, o vendedor vê "erro de rede". Mitigações:
  - no app: timeout maior (≥ 60–90 s) **só na primeira chamada** + tela "conectando ao servidor…" e retry com backoff;
  - antes de demo/sessão de teste: "acordar" a API manualmente (abrir `/health` 2 min antes);
  - opcional, durante 09–13/11 e 07–11/12: ping externo a cada ~10 min. Um único serviço 24/7 consome ~744 h/mês, **dentro das 750 h** — mas só se for o **único** serviço free no workspace. O endpoint pingado **não pode tocar o banco**, senão impede o Neon de suspender e consome as horas de compute dele (ver §2).
- **Disco efêmero:** no Render free, qualquer arquivo gravado no container some quando ele dorme ou é redeployado. **Fotos não podem ficar no disco da API.**
- Fastify precisa escutar em `0.0.0.0` e na porta `process.env.PORT` (Render usa 10000 por padrão) — [render.com/docs/web-services](https://render.com/docs/web-services).

---

## 2. PostgreSQL (via DrizzleORM)

| Opção | Armazenamento | Expira? / pausa? | Conexões / pooling | Cartão? |
|---|---|---|---|---|
| **Neon Free** | 1 GB por projeto (20 GB somando projetos); 5 GB de egress/projeto/mês | **Não expira** ("permanent, not a trial"). Suspende após **5 min** de inatividade (fixo no Free) e reativa "within a few hundred milliseconds". **100 CU-hours/projeto/mês** (= 400 h a 0,25 CU); se esgotar, compute fica suspenso até o próximo ciclo | PgBouncer em modo transação, até 10.000 conexões de cliente; 0,25 CU = `max_connections` 104 (97 para a aplicação) | Não |
| **Supabase Free** | **500 MB** de banco; 2 projetos ativos | **Pausa após 7 dias de baixa atividade**; restaurável por até 1 ano pelo Studio | Conexão direta só IPv6 no free; pooler Supavisor (IPv4): sessão na 5432, transação na 6543 — transação **não suporta prepared statements** (`prepare: false` no postgres.js/Drizzle) | Não informado na página de preços |
| **Render Postgres Free** | 1 GB | **Expira 30 dias após a criação** (+14 dias de carência, depois os dados são apagados). Sem backups. 1 banco free por workspace | Sem pooling gerenciado | Não |
| **Prisma Postgres Free** | 1,01 GB; até 50 bancos | "Free forever", sem limite de tempo | **10 conexões diretas, 5 reservadas à plataforma** → ~5 para a app; **200 mil operações/mês** (cada query = 1 op) | Não |
| **Koyeb Postgres Free** | 1 GB; 0,25 vCPU / 1 GB RAM | Dorme após 5 min; **apenas 5 h de compute por mês** | ~112 conexões | Cartão exigido na conta Koyeb |
| **Aiven Free** | 1 GB storage, 1 GB RAM | Sem prazo, mas serviços sem atividade "can be powered off" (com notificação; período não especificado); Aiven pode mudar região/nuvem a qualquer momento | Não especificado | Não |
| **Xata** | — | Sem free tier na nuvem: trial de 14 dias, depois ~US$ 9/mês | — | Após o trial |

Fontes:
- Neon preços: <https://neon.com/pricing> · planos: <https://neon.com/docs/introduction/plans> · scale-to-zero: <https://neon.com/docs/introduction/scale-to-zero> · pooling: <https://neon.com/docs/connect/connection-pooling> · regiões (inclui São Paulo `aws-sa-east-1` e US East `aws-us-east-1`): <https://neon.com/docs/introduction/regions>
- Supabase preços: <https://supabase.com/pricing> · pausa: <https://supabase.com/docs/guides/platform/free-project-pausing> · conexões: <https://supabase.com/docs/guides/database/connecting-to-postgres>
- Render Postgres free: <https://render.com/docs/free>
- Prisma Postgres: <https://www.prisma.io/pricing> · conexões: <https://www.prisma.io/docs/postgres/database/connection-pooling>
- Koyeb Postgres: <https://www.koyeb.com/docs/databases> · <https://www.koyeb.com/docs/faqs/pricing>
- Aiven: <https://aiven.io/free-tier> · <https://aiven.io/docs/platform/concepts/free-plan>
- Xata: <https://xata.io/pricing>

### Compatibilidade com Drizzle

- Drizzle lista oficialmente Neon, Supabase, Prisma Postgres, Xata, além dos drivers nativos `node-postgres` e `postgres.js` — [orm.drizzle.team/docs/get-started-postgresql](https://orm.drizzle.team/docs/get-started-postgresql).
- **Neon:** para servidor de longa duração (nosso caso, Fastify em container), a doc do Drizzle diz: "To use Neon from a serverful environment, you can use the node-postgres or Postgres.js drivers." — [orm.drizzle.team/docs/connect-neon](https://orm.drizzle.team/docs/connect-neon). Ou seja, **o mesmo driver `pg` usado no Postgres local do Docker Compose funciona no Neon**; só muda a `DATABASE_URL`.
- Com pooler em modo transação (Neon `-pooler` ou Supabase 6543): prepared statements no nível SQL (`PREPARE`) não funcionam; os do protocolo funcionam no Neon (PgBouncer ≥ 1.22). No Supabase, a doc manda usar `prepare: false` com postgres.js/Drizzle. **Migrations do drizzle-kit devem usar a URL direta (sem pooler).**
- **Prisma Postgres:** funciona com Drizzle via `pg` ou `postgres.js` ([orm.drizzle.team/docs/connect-prisma-postgres](https://orm.drizzle.team/docs/connect-prisma-postgres)), mas ~5 conexões e 200 mil queries/mês é apertado se alguém deixar um loop ou polling rodando.

### Pegadinhas do banco

- **Render Postgres expira antes de dezembro.** Criado em 12/10, expira em ~11/11 — **no meio da semana de testes** — e é apagado em ~25/11. **Descartado.**
- **Supabase pausa após 7 dias de baixa atividade.** Entre o fim dos testes (13/11) e a apresentação (07/12) são 24 dias: se ninguém usar, o projeto pausa. Restaurar é um clique, mas é um passo manual que pode falhar na véspera. Contornável com uso semanal real, mas é um risco a mais.
- **Neon: as 100 CU-hours acabam se o banco nunca dormir.** 0,25 CU 24/7 ≈ 180 CU-h/mês → estoura. Por isso: limitar o autoscaling do Free a 0,25 CU (o padrão do Free vai até 2 CU) e garantir que healthcheck/ping da API **não** faça query no banco. Com uso normal de demo, o banco passa a maior parte do tempo suspenso.
- **Região:** colocar o banco perto da API, não perto do usuário. Render não tem região na América do Sul; com API em Virginia, usar Neon `aws-us-east-1` (cada query de Fastify → Postgres fica intra-região, e só a requisição do celular atravessa até os EUA).

---

## 3. Fotos de auditoria de PDV

### Onde guardar

| Opção | Free tier | Egress | Upload direto do app (presigned) | Cartão? |
|---|---|---|---|---|
| **Cloudflare R2** | 10 GB-mês, 1 M ops classe A, 10 M classe B por mês | **Grátis** | Sim: presigned `PUT`, expiração de 1 s a 7 dias; recomenda fixar `ContentType` na assinatura | Precisa "Complete the checkout flow to add an R2 subscription"; relatos na comunidade Cloudflare indicam que esse checkout pede cartão (com pré-autorização temporária de US$ 5) |
| **Supabase Storage** | 1 GB de arquivos; 5 GB de egress (+5 GB em cache); arquivo de até 50 MB | 5 GB | Sim: `createSignedUploadUrl` gera URL de upload válida por **2 h**, sem outra autenticação; também aceita protocolo S3 | Não informado |
| **Cloudinary** | 25 créditos/mês; 1 crédito = 1 GB armazenado **ou** 1 GB de banda **ou** 1.000 transformações | Conta nos créditos | Sim: upload assinado (assinatura gerada no backend) ou preset não assinado | **"No credit card required"** |
| **Backblaze B2** | Primeiros 10 GB grátis; egress grátis até 3× o armazenamento médio | 3× storage | Compatível com S3 (presigned) | Página não diz que o free exige cartão |
| **AWS S3** | Contas novas: plano grátis de **6 meses** com US$ 100–200 em créditos; a conta "closes on its own 6 months after you open it or when your credits run out" | — | Sim | Não citado na página, mas é conta AWS completa (IAM, região, bucket policy) |
| **Neon Object Storage** | 5 GB/projeto no Free, compatível com S3, presigned GET/PUT e CORS | Divide os 5 GB de egress do projeto | Sim | Não — mas o changelog de 03/07/2026 diz "currently in private preview", e não está disponível em São Paulo |
| **Disco da API** | — | — | — | **Inviável:** disco do Render free é efêmero |
| **Banco (`bytea`)** | — | — | — | **Desaconselhado:** come o 1 GB do Neon / 500 MB do Supabase e o egress de 5 GB, deixa backups e queries mais pesados |

Fontes:
- R2 preços: <https://developers.cloudflare.com/r2/pricing/> · get started (assinatura via checkout): <https://developers.cloudflare.com/r2/get-started/> · presigned URLs: <https://developers.cloudflare.com/r2/api/s3/presigned-urls/> · relato de exigência de cartão (fonte **não oficial**, comunidade): <https://community.cloudflare.com/t/why-using-r2-free-tier-involves-giving-card-info/945179>
- Supabase: <https://supabase.com/pricing> · <https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl> · <https://supabase.com/docs/guides/storage/uploads/s3-uploads>
- Cloudinary: <https://cloudinary.com/pricing> · upload: <https://cloudinary.com/documentation/upload_images>
- Backblaze B2: <https://www.backblaze.com/cloud-storage/pricing>
- AWS Free Tier: <https://aws.amazon.com/free/>
- GCP Cloud Storage free (5 GB-mês, só regiões dos EUA, exige billing account): <https://docs.cloud.google.com/free/docs/free-cloud-features>
- Neon Object Storage: <https://neon.com/docs/storage/overview> · <https://neon.com/docs/storage/s3-compatibility> · <https://neon.com/docs/changelog/2026-07-03> · regiões: <https://neon.com/docs/introduction/regions>

### Upload direto (presigned) vs. via API

**Recomendado: presigned URL (upload direto do celular para o storage).** Fluxo:

1. App autenticado chama `POST /auditorias/:id/fotos/upload-url` na API.
2. API valida permissão, gera chave (ex.: `auditorias/{id}/{uuid}.jpg`) e devolve uma URL de `PUT` assinada, curta (ex.: 5 min) e presa ao `Content-Type: image/jpeg`.
3. App faz `PUT` do JPEG direto no bucket.
4. App chama `POST /auditorias/:id/fotos` com a chave; a API grava a referência no Postgres.
5. Painel web exibe com URL de `GET` assinada (ou bucket público de leitura, se aceitável).

Por que é melhor no nosso cenário: o arquivo não passa pela instância free (0,1 vCPU/512 MB, que pode estar acordando), não ocupa disco efêmero e não gasta banda da API. A API só assina, então as credenciais do storage ficam **só no `.env` da API** e nunca no app nem no repositório. Com Cloudinary, o equivalente é o **upload assinado**: o backend gera a assinatura. Evitar preset não assinado, porque o nome do preset fica embutido no APK.

**Via API (multipart no Fastify)** é aceitável como fallback, por ser mais simples de implementar e testar, mas sofre com cold start e timeouts em rede móvel.

**Comum aos dois:** o app deve redimensionar/comprimir antes de enviar (ex.: `expo-image-manipulator`) e, se o PDV estiver sem sinal, guardar localmente e reenviar depois.

---

## 4. Painel web React (estático)

| Opção | Free tier (resumo) | Observação |
|---|---|---|
| **Cloudflare Pages** | 500 builds/mês, 20.000 arquivos por site, 100 domínios por projeto | Cloudflare também sugere Workers Static Assets; SPA via `not_found_handling = "single-page-application"` |
| **Vercel Hobby** | 100 GB Fast Data Transfer, 100 deploys/dia | "the Hobby plan restricts users to non-commercial, personal use only" (projeto acadêmico se encaixa); sem recursos de colaboração em time no Hobby |
| **Netlify Free** | Modelo de créditos: limite de 300 créditos; banda custa 20 créditos/GB | A página não detalha o que acontece ao estourar |
| **Render Static Site** | Sites estáticos são gratuitos | Mesmo provedor da API (menos contas) |

Fontes: <https://developers.cloudflare.com/pages/platform/limits/> · <https://developers.cloudflare.com/workers/static-assets/> · <https://vercel.com/docs/plans/hobby> (last_updated 2026-09-14) · <https://www.netlify.com/pricing/> · <https://render.com/docs/free>

Para um painel Vite/React estático, todas atendem. O critério deve ser **ter o menor número de contas**: Render Static Site (mesma conta da API) ou Cloudflare Pages (mesma conta do R2, se o R2 for adotado). A URL da API entra como variável de build (`VITE_API_URL`), que é pública por natureza: **nenhum segredo vai para o bundle do painel**.

---

## 5. Credenciais fora do repositório

Todos os provedores recomendados permitem configurar variáveis de ambiente pelo dashboard (Render: env vars/secret files do serviço). Proposta:

- `.env.example` versionado só com os **nomes** (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `JWT_SECRET`…);
- valores reais só no painel do provedor e no `.env` local (já ignorado pelo `.gitignore` geral);
- o app mobile só conhece a URL pública da API (`EXPO_PUBLIC_API_URL`). Qualquer variável `EXPO_PUBLIC_*` vai embutida no APK, então **nunca** chaves de storage/banco.

---

## Recomendação

**Combinação principal (custo zero, sem cartão no caminho crítico):**

| Camada | Escolha | Por quê |
|---|---|---|
| API | **Render Free Web Service** (Docker, região **Virginia**) | Sem cartão, HTTPS `onrender.com` incluso, deploy por Dockerfile a partir do GitHub, 750 h cobrem 1 serviço 24/7. Ponto fraco: cold start de ~1 min, contornável com o tratamento no app e com warm-up antes das sessões |
| Postgres | **Neon Free** (região `aws-us-east-1`, autoscaling travado em 0,25 CU) | Não expira, não exige cartão, acorda em centenas de ms, 1 GB sobra, Drizzle via `pg` igual ao ambiente local, branches úteis para dev/demo |
| Fotos | **Cloudflare R2** com presigned `PUT`, **se um membro aceitar cadastrar cartão** (uso real ≪ 10 GB, egress grátis → custo esperado zero). **Sem cartão: Cloudinary Free** com upload assinado pelo backend | R2 é S3 padrão (`@aws-sdk/client-s3` + `s3-request-presigner`), o que facilita trocar de provedor depois. Cloudinary não exige cartão e 25 créditos sobram para < 100 MB |
| Painel web | **Render Static Site** (ou Cloudflare Pages, se o R2 for adotado) | Menos contas para gerenciar |

**Fallback (se o Render ou o Neon mudarem as regras ou falharem):** **Koyeb Free Instance** para a API (cold start de segundos em vez de ~1 min, mas exige cartão e só tem Frankfurt/Washington) + **Supabase Free** para Postgres **e** Storage (um provedor só, com `createSignedUploadUrl` para upload direto; atenção à pausa por 7 dias de inatividade, ao limite de 500 MB e ao `prepare: false` no pooler em modo transação).

**Descartados:** Render Postgres (expira em 30 dias, antes da apresentação), Fly.io (sem free tier), Railway (US$ 1/mês não sustenta o container), Xata (só trial), Koyeb Postgres (5 h/mês), Neon Object Storage (private preview), fotos no disco da API (efêmero) ou no banco.

## Pontos que a decisão "Infra e ambientes de dev e demo" precisa fechar

1. **Cartão:** alguém da equipe aceita cadastrar cartão (pré-autorização de US$ 5 no R2; obrigatório no Koyeb)? Isso decide entre R2 e Cloudinary, e se o fallback Koyeb é viável.
2. **Dono das contas:** quem cria cada conta (Render, Neon, storage, painel) e como os outros 2 membros ganham acesso. Ex.: uma conta compartilhada da equipe com e-mail do grupo, já que planos free costumam não ter colaboração em time.
3. **Estratégia de cold start:** aceitar ~1 min no primeiro acesso + UI "acordando servidor"? Ou ligar um ping externo só nas janelas 09–13/11 e 07–11/12? Definir também o timeout do cliente HTTP no app.
4. **Upload de fotos:** presigned URL direto do app (recomendado) ou multipart via API? Definir também tamanho/resolução máxima da foto comprimida e se o painel lê por URL assinada ou bucket público.
5. **Ambientes:** quantos? Proposta: `dev` = Docker Compose local com Postgres local; `demo` = Render + Neon (branch `main`). Usar branch do Neon para teste antes da demo? Seed de dados da demo?
6. **Região:** confirmar Render Virginia + Neon `aws-us-east-1` (latência API↔banco) e aceitar ~130–200 ms extras do Brasil até os EUA (estimativa nossa, não medida).
7. **Gestão de segredos:** lista final de variáveis no `.env.example`, onde ficam os valores reais e quem os rotaciona se vazar.
8. **Data de criação das contas e checklist de revalidação:** reconfirmar os limites desta pesquisa no dia da criação e de novo ~1 semana antes de 09/11 e de 07/12. Incluir o "acordar banco e API" no roteiro da apresentação.
9. **Plano B no dia da apresentação:** ter a API + Postgres rodando localmente via Docker Compose num notebook, exposto por túnel HTTPS, caso o free tier falhe. Avaliar a ferramenta de túnel em outra pesquisa: não foi pesquisada aqui.
