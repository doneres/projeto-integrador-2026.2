# Módulo de Requisitos do Sistema — AXIS

Este diretório centraliza a especificação de engenharia de requisitos do sistema **AXIS (Account eXecution & Inventory Sales system)**, em conformidade com as diretrizes do **Documento Norteador do Projeto Integrador (PUC Goiás - 2026/2)**.

---

## Documentos da Seção

1. [**Requisitos Funcionais (RF)**](./funcionais.md) — 25 requisitos funcionais categorizados em 6 módulos e priorizados via MoSCoW.
2. [**Requisitos Não Funcionais (RNF)**](./nao-funcionais.md) — 10 requisitos não funcionais de desempenho, confiabilidade, segurança e usabilidade.
3. [**Requisitos Norteadores (R1–R14)**](./requisitos-norteadores.md) — os 14 requisitos mínimos do Documento Norteador e onde cada um é atendido no AXIS.

---

## Regras de Negócio Não Triviais (RN)

Para atender à exigência do **Requisito R4** (mínimo de 3 regras de negócio não triviais documentadas e verificáveis):

### **RN01 — Validação de Raio de Proximidade (Geofencing) para Check-in**
- **Descrição:** O vendedor só pode iniciar uma visita (Check-in) *No Local* se sua localização atual estiver a no máximo **20 metros** das coordenadas de latitude/longitude cadastradas para o cliente. O raio é um parâmetro do sistema (`RAIO_CHECKIN_METROS`, padrão 20) para permitir ajuste após os testes em campo.
- **Cálculo da distância (fórmula de Haversine):** sendo φ a latitude e λ a longitude, em radianos, do aparelho (1) e do cliente (2), e R = 6.371.000 m o raio médio da Terra:

  ```
  a = sin²(Δφ / 2) + cos(φ1) · cos(φ2) · sin²(Δλ / 2)
  d = 2 · R · atan2(√a, √(1 − a))        (d em metros)
  ```

- **Comportamento Esperado:**
  | Situação | Resultado |
  |---|---|
  | `d ≤ 20 m` | Check-in registrado com status *No Local*. |
  | `d > 20 m` | Check-in só é permitido com **justificativa obrigatória** (ex.: "Endereço cadastrado divergente", "Sinal de GPS fraco" ou texto livre). A visita recebe status *Fora do Raio* e uma **flag de auditoria** visível ao gestor no painel web. |
  | Precisão do GPS pior que 50 m (`accuracy > 50`) | O app avisa que o sinal está impreciso e oferece nova leitura antes de calcular a distância. |
  | Android indica localização simulada (`mocked = true`) | Check-in **bloqueado**. |
- **Dados registrados no check-in:** data/hora, latitude, longitude, precisão informada pelo GPS (`accuracy`), distância calculada até o cliente e justificativa (quando houver).
- **Observação:** como a precisão do GPS em área urbana fica tipicamente entre 5 e 50 m (ver [`docs/pesquisas/expo-recursos-nativos-build.md`](../pesquisas/expo-recursos-nativos-build.md)), o caminho de justificativa é o que evita bloquear um vendedor que de fato está no cliente.

### **RN02 — Cálculo Dinâmico e Ponderado de Atingimento de Metas**
- **Descrição:** O gestor define, para cada vendedor e para cada **mês civil**, três alvos: valor de vendas (R$), quantidade de visitas realizadas e quantidade de novos clientes. O progresso do vendedor é um **score de 0% a 100%**, obtido pela média ponderada do atingimento de cada indicador.
- **Fórmula:**

  ```
  Atingimento de cada indicador = mínimo(realizado ÷ meta, 1)      (teto de 100%)

  Score = 0,50 × Atingimento de Faturamento
        + 0,30 × Atingimento de Visitas Realizadas
        + 0,20 × Atingimento de Novos Clientes
  ```

  O teto de 100% por indicador impede que superar muito um indicador compense não cumprir os outros.
- **O que conta em cada indicador (dentro do mês):**
  | Indicador | Conta como realizado |
  |---|---|
  | Faturamento | Soma dos pedidos do vendedor com status *Confirmado* (pedidos cancelados não contam). |
  | Visitas Realizadas | Visitas com check-in **e** check-out registrados e desfecho diferente de *Não Realizada*. |
  | Novos Clientes | Prospecções cadastradas pelo vendedor e **aprovadas** pelo gestor no mês. |
- **Exemplo:** meta de R$ 50.000, 100 visitas e 5 novos clientes; realizado R$ 40.000, 90 visitas e 6 novos clientes.
  - Faturamento: 40.000 ÷ 50.000 = 80%
  - Visitas: 90 ÷ 100 = 90%
  - Novos clientes: 6 ÷ 5 = 120% → limitado a 100%
  - **Score = 0,50 × 80 + 0,30 × 90 + 0,20 × 100 = 40 + 27 + 20 = 87%**
- **Comportamento Esperado:** O score é recalculado a cada pedido confirmado, visita finalizada ou prospecção aprovada, e exibido no painel do gestor (Web) e no resumo de metas do vendedor (Mobile). Se uma meta do mês não tiver sido cadastrada, o indicador correspondente aparece como "sem meta" e o score não é exibido.

### **RN03 — Auditoria Obrigatória de Materiais em Comodato**
- **Descrição:** Para clientes que possuam materiais de PDV em comodato vinculados (ex: geladeira, display expositor), o vendedor não pode concluir o Check-out da visita sem preencher o checklist de integridade de cada item cadastrado.
- **Comportamento Esperado:** A interface mobile bloqueia o botão de finalizar visita até que todos os itens de PDV alocados naquele cliente recebam uma classificação de status (*Íntegro*, *Avariado*, *Ausente*, *Manutenção*) e ao menos 1 registro fotográfico comprobatório.

### **RN04 — Bloqueio de Emissão de Pedido para Clientes em Prospecção**
- **Descrição:** Um vendedor pode cadastrar novos clientes em campo como "Prospecção", porém a emissão de pedidos com faturamento a prazo só é liberada após a aprovação e homologação cadastral pelo Supervisor/Gestor no painel Web.
- **Comportamento Esperado:** Clientes prospectados ficam com status *Pendente de Aprovação*. No app mobile, a tentativa de emissão de venda a prazo exibe alerta de restrição cadastral.

### **RN05 — Resolução de Sincronização e Conflitos Offline**
- **Descrição:** Quando o vendedor realiza atendimentos em áreas sem conectividade (modo offline), as operações são armazenadas em fila local com carimbo de data/hora (*timestamp* do momento da ação).
- **Comportamento Esperado:** Ao recuperar a conexão, os eventos são enviados em lote ordenados cronologicamente pelo timestamp da criação local, garantindo que a sequência de check-in $\rightarrow$ auditoria $\rightarrow$ pedido $\rightarrow$ check-out seja preservada no banco remoto.
