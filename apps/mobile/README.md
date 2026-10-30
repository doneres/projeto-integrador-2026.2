# AXIS: App do Vendedor

Aplicativo usado pelo Vendedor em campo para executar a rota do dia, fazer check-in e check-out, auditar o ponto de venda e emitir pedidos. Este é o esqueleto: abre no Expo Go, tem a estrutura de camadas e os componentes base acessíveis, e fica pronto para receber as telas.

## Stack

- Expo SDK 58 (React Native 0.88) e Expo Router, com rotas em português
- NativeWind 4 (Tailwind CSS 3 para React Native)
- Contrato da API em [`@axis/contracts`](../../packages/contracts/README.md) (schemas Zod)
- Jest (`jest-expo`) e React Native Testing Library
- Biome (lint e formatação, configurado na raiz do repositório)

## Como rodar no Expo Go

O app roda no **Expo Go**, sem build nativo. Você precisa de:

- Node.js 24 e pnpm (veja o README da raiz).
- Expo Go instalado no celular (iPhone ou Android) e uma conta Expo gratuita, ou um emulador Android.
- Celular e computador na **mesma rede Wi-Fi**.

Passo a passo, a partir da raiz do repositório:

```bash
pnpm install
cp apps/mobile/.env.example apps/mobile/.env   # ajuste o IP (veja abaixo)
pnpm --filter @axis/mobile start
```

1. O terminal mostra um QR code.
2. **iPhone:** abra a câmera e aponte para o QR code. **Android:** abra o Expo Go e use *Scan QR code*.
3. A tela inicial do AXIS abre no Expo Go.

Se o celular não encontrar o computador (rede da faculdade com isolamento, por exemplo), rode `pnpm --filter @axis/mobile start --tunnel`.

> O Expo Go das lojas só aceita o SDK mais recente. O projeto está no SDK 58; se o Expo Go reclamar de versão, atualize o app pela loja.

## Variável de ambiente

Só a URL da API entra no app. O Expo embute no bundle tudo que começa com `EXPO_PUBLIC_`, então nunca coloque segredo aqui.

| Variável | Para quê |
|---|---|
| `EXPO_PUBLIC_API_URL` | Endereço da API, sem barra no final (ex.: `http://192.168.0.10:3000`) |

No Expo Go, `localhost` aponta para o próprio celular. Use o **IP da sua máquina na rede**. O `.env.example` mostra o formato; o `.env` real não vai para o Git. O app valida a variável ao ler o ambiente (`getEnv` em `src/services/env.ts`) e falha com mensagem clara se ela faltar.

## Scripts

Dentro de `apps/mobile` (ou na raiz, com `pnpm --filter @axis/mobile <script>`):

| Comando | O que faz |
|---|---|
| `pnpm start` | Servidor do Expo (QR code para o Expo Go) |
| `pnpm android` / `pnpm ios` | Abre no emulador Android / simulador iOS |
| `pnpm typecheck` | Só a checagem de tipos |
| `pnpm test` | Testes automatizados (Jest) |

Lint e formatação rodam na raiz: `pnpm lint` verifica e `pnpm lint:fix` corrige.

## Estrutura

```
app/            rotas do Expo Router (arquivos finos que só exportam uma tela)
src/
  screens/      composição das telas, sem regra de negócio
  components/   componentes base (NativeWind), sem acesso a dados
  hooks/        ligam o React a repositories e services
  repositories/ acesso a dados (API; depois SQLite com outbox)
  services/     regras e integrações (ambiente, cliente HTTP, GPS, câmera)
  theme/        tokens de cor e verificação de contraste
```

A dependência aponta num sentido só: `screens → hooks → repositories/services`. `src/layers.test.ts` falha se uma camada importar de onde não deve.

Textos da interface e caminhos de `app/` ficam em português; o código (nomes, tipos, funções) fica em inglês (ADR 0001). O alias `@/` aponta para `src/`.

## Acessibilidade (RNF03)

- Use `Button`, `TextField`, `ListItem` e `Checkbox` de `src/components`. Telas não usam `Pressable` solto.
- Os quatro exigem `accessibilityLabel` e `accessibilityRole` no TypeScript: esquecer um dos dois não compila.
- Todo alvo de toque tem no mínimo 48 dp (`MIN_TOUCH_TARGET`).
- As cores vêm de `src/theme/colors.ts`, que alimenta o Tailwind (`bg-primary`, `text-textMuted`...). Todo par de texto e fundo tem contraste de pelo menos 4,5:1; `contrast.test.ts` confere. Ao criar uma cor de texto, acrescente o par em `textPairs`.
- Status nunca é só cor: acompanhe de texto (e ícone).
- O Biome não tem regras de acessibilidade para React Native. Antes do beta e das sessões de teste, faça o passe manual com o TalkBack num aparelho Android.

## Testes

Os testes ficam ao lado do arquivo testado (`*.test.ts`, `*.test.tsx`). Para rodar um arquivo só: `pnpm test src/components`.
