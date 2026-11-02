# Módulo de Requisitos do Sistema — AXIS

Este diretório centraliza a especificação de engenharia de requisitos do sistema **AXIS (Account eXecution & Inventory Sales system)**, em conformidade com as diretrizes do **Documento Norteador do Projeto Integrador (PUC Goiás - 2026/2)**.

---

## Documentos da Seção

1. [**Requisitos Funcionais (RF)**](./funcionais.md) — 25 requisitos funcionais categorizados em 6 módulos e priorizados via MoSCoW.
2. [**Requisitos Não Funcionais (RNF)**](./nao-funcionais.md) — 10 requisitos não funcionais de desempenho, confiabilidade, segurança e usabilidade.
3. [**Requisitos Norteadores (R1–R14)**](./requisitos-norteadores.md) — os 14 requisitos mínimos do Documento Norteador e onde cada um é atendido no AXIS.

---

## Regras de Negócio Não Triviais (RN)

Para atender à exigência do **Requisito R4** (mínimo de 3 regras de negócio não triviais documentadas e verificáveis). Os parâmetros finais foram decididos nas issues #25 (RN01 a RN04) e #27 (RN05).

### **RN01 — Validação de Raio de Proximidade (Geofencing) para Check-in**
- **Descrição:** O check-in é classificado como *No Local* quando a posição do aparelho está a no máximo **100 metros** das coordenadas do cliente. O raio é um parâmetro do sistema, definido pelo **Administrador** (`RAIO_CHECKIN_METROS`, padrão 100), e será reajustado depois dos testes de campo. **A distância nunca bloqueia o check-in:** fora do raio, ele segue com justificativa.
- **Cálculo da distância (fórmula de Haversine):** sendo φ a latitude e λ a longitude, em radianos, do aparelho (1) e do cliente (2), e R = 6.371.000 m o raio médio da Terra:

  ```
  a = sin²(Δφ / 2) + cos(φ1) · cos(φ2) · sin²(Δλ / 2)
  d = 2 · R · atan2(√a, √(1 − a))        (d em metros)
  ```

- **Comportamento Esperado:**
  | Situação | Resultado |
  |---|---|
  | `d ≤ raio` | Check-in registrado com status *No Local*. |
  | `d > raio` | Check-in segue com **justificativa obrigatória**, status *Fora do Raio* e **flag de auditoria**, vista pelo Coordenador (da sua equipe) e pelo Diretor (todas as equipes). |
  | Precisão do GPS pior que 50 m (`accuracy > 50`) | O app avisa e oferece **uma** nova leitura. Se continuar ruim, o check-in segue pelo caminho da justificativa, com a `accuracy` registrada. |
  | Android indica localização simulada (`mocked = true`) | Check-in **bloqueado**. |
  | Permissão de localização apenas aproximada | Check-in **bloqueado** até o usuário conceder a localização precisa, com aviso e atalho para as configurações. |
- **Dados registrados no check-in:** data/hora, latitude, longitude, precisão informada pelo GPS (`accuracy`), distância calculada até o cliente e justificativa (quando houver).
- **Onde a regra é aplicada:** no servidor, que recalcula a distância a partir das coordenadas recebidas.
- **Observação:** a precisão do GPS em área urbana fica tipicamente entre 5 e 50 m (ver [`docs/pesquisas/expo-recursos-nativos-build.md`](../pesquisas/expo-recursos-nativos-build.md)). Por isso o raio padrão é de 100 m e o caminho de justificativa substitui o bloqueio.

### **RN02 — Cálculo Dinâmico e Ponderado de Atingimento de Metas**
- **Descrição:** O **Diretor** define, para cada vendedor e para cada **mês civil**, três alvos: valor de vendas (R$), quantidade de visitas realizadas e quantidade de novos clientes. O progresso do vendedor é um **score de 0% a 100%**, obtido pela média ponderada do atingimento de cada indicador.
- **Fórmula:**

  ```
  Atingimento de cada indicador = mínimo(realizado ÷ meta, 1)      (teto de 100%)

  Score = 0,50 × Atingimento de Faturamento
        + 0,30 × Atingimento de Visitas Realizadas
        + 0,20 × Atingimento de Novos Clientes
  ```

  O teto de 100% por indicador impede que superar muito um indicador compense não cumprir os outros. Os pesos 50/30/20 são **parâmetros do Administrador**, com soma obrigatória de 100%.
- **O que conta em cada indicador (dentro do mês):**
  | Indicador | Conta como realizado |
  |---|---|
  | Faturamento | Soma de **todos os pedidos emitidos** pelo vendedor. O mês é o do momento em que o pedido foi feito no aparelho, para que um pedido registrado offline caia no mês certo. |
  | Visitas Realizadas | Visitas com check-in **e** check-out registrados e desfecho diferente de *Não Realizada*. |
  | Novos Clientes | Prospecções cadastradas pelo vendedor e **aprovadas** pelo Coordenador, contadas no mês da **aprovação**. |
- **Exemplo:** meta de R$ 50.000, 100 visitas e 5 novos clientes; realizado R$ 40.000, 90 visitas e 6 novos clientes.
  - Faturamento: 40.000 ÷ 50.000 = 80%
  - Visitas: 90 ÷ 100 = 90%
  - Novos clientes: 6 ÷ 5 = 120% → limitado a 100%
  - **Score = 0,50 × 80 + 0,30 × 90 + 0,20 × 100 = 40 + 27 + 20 = 87%**
- **Comportamento Esperado:** O score é calculado na leitura, a partir dos dados registrados, e exibido no painel (Diretor: todas as equipes; Coordenador: sua equipe) e no resumo de metas do vendedor (Mobile). Se uma meta do mês não tiver sido cadastrada, o indicador correspondente aparece como "sem meta" e o score não é exibido.

### **RN03 — Auditoria Obrigatória de Materiais em Comodato**
- **Descrição:** Para clientes com materiais de PDV em comodato (ex.: geladeira, display expositor), o vendedor não pode concluir o check-out da visita sem auditar **cada item** emprestado ao cliente.
- **Comportamento Esperado:**
  | Estado do item | Exigência |
  |---|---|
  | *Avariado* ou *Necessita Manutenção* | Foto obrigatória do item |
  | *Ausente* | Justificativa em texto (no lugar da foto) |
  | *Íntegro* | Foto opcional |
  - A visita precisa ter **ao menos 1 foto** quando o cliente possui comodato.
  - O bloqueio do check-out vale **também offline** (validação no aparelho) e é **reaplicado pelo servidor** quando a visita sincroniza.
  - Cliente sem comodato não passa por esta regra.

### **RN04 — Bloqueio de Pedido e de Visita para Clientes em Prospecção**
- **Descrição:** O vendedor pode cadastrar em campo um cliente novo como *Prospecção*. Enquanto ele estiver *Pendente de aprovação*, **não recebe nenhum pedido**, **não entra em rota** e **não recebe check-in**, até ser aprovado pelo **Coordenador** no painel web.
- **Comportamento Esperado:**
  - A API rejeita o pedido de um cliente que não esteja ativo.
  - Prospecção **rejeitada** pelo Coordenador passa a *Rejeitada* e fica no histórico com o motivo; não é excluída.
  - Não há forma de pagamento nem análise de crédito nesta versão.

### **RN05 — Sincronização Offline Ordenada**
- **Descrição:** Tudo o que o vendedor faz em campo (check-in, auditoria com fotos, pedido, check-out e cadastro de prospecção) funciona sem conexão. Cada ação é gravada no aparelho e entra numa **fila local, ordenada pela sequência de registro** no aparelho (não pelo relógio do aparelho, que pode estar errado).
- **Comportamento Esperado:**
  - Com conexão, a fila é enviada em segundos, na ordem em que as ações foram registradas, preservando a sequência check-in → auditoria → fotos → pedido → check-out.
  - Repetir o envio de uma ação não a duplica: cada ação leva um identificador gerado no aparelho.
  - Se o servidor recusar uma ação (por exemplo, cliente inativado enquanto o vendedor estava offline), **o servidor vence**: a ação aparece como "não aceita pelo servidor", bloqueia as ações seguintes da mesma visita, e o vendedor pode tentar de novo ou descartar.
  - Detalhes de arquitetura: issue #27 e ADR `docs/adr/0002-app-local-first-com-outbox.md`.
