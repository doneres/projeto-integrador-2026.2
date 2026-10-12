# Módulo de Requisitos do Sistema — AXIS

Este diretório centraliza a especificação de engenharia de requisitos do sistema **AXIS (Account eXecution & Inventory Sales system)**, em conformidade com as diretrizes do **Documento Norteador do Projeto Integrador (PUC Goiás - 2026/2)**.

---

## Documentos da Seção

1. [**Requisitos Funcionais (RF)**](./funcionais.md) — 25 requisitos funcionais categorizados em 6 módulos e priorizados via MoSCoW.
2. [**Requisitos Não Funcionais (RNF)**](./nao-funcionais.md) — 10 requisitos não funcionais de desempenho, confiabilidade, segurança e usabilidade.

---

## Regras de Negócio Não Triviais (RN)

Para atender à exigência do **Requisito R4** (mínimo de 3 regras de negócio não triviais documentadas e verificáveis):

### **RN01 — Validação de Raio de Proximidade (Geofencing) para Check-in**
- **Descrição:** O vendedor só pode iniciar uma visita (Check-in) se sua localização física atual estiver em um raio de até **150 metros** das coordenadas de latitude/longitude cadastradas para o cliente.
- **Comportamento Esperado:** A aplicação mobile calcula a distância geodésica (fórmula de Haversine). Se a distância for $\le 150\text{m}$, o check-in é validado com status *No Local*. Se a distância for $> 150\text{m}$, o sistema bloqueia o check-in ou exige justificativa formal de exceção (ex: "Endereço cadastrado divergente"), sinalizando flag de auditoria para o gestor.

### **RN02 — Cálculo Dinâmico e Ponderado de Atingimento de Metas**
- **Descrição:** O progresso consolidado de metas do vendedor no ciclo corrente é calculado através de uma média ponderada de três indicadores estratégicos distintos:
  $$\text{Score Global} = (0.50 \times \%\text{ Faturamento}) + (0.30 \times \%\text{ Visitas Realizadas}) + (0.20 \times \%\text{ Novos Clientes})$$
- **Comportamento Esperado:** O cálculo é atualizado em tempo real no painel do supervisor e resumido no mobile do vendedor a cada pedido aprovado ou visita finalizada.

### **RN03 — Auditoria Obrigatória de Materiais em Comodato**
- **Descrição:** Para clientes que possuam materiais de PDV em comodato vinculados (ex: geladeira, display expositor), o vendedor não pode concluir o Check-out da visita sem preencher o checklist de integridade de cada item cadastrado.
- **Comportamento Esperado:** A interface mobile bloqueia o botão de finalizar visita até que todos os itens de PDV alocados naquele cliente recebam uma classificação de status (*Íntegro*, *Avariado*, *Ausente*, *Manutenção*) e ao menos 1 registro fotográfico comprobatório.

### **RN04 — Bloqueio de Emissão de Pedido para Clientes em Prospecção**
- **Descrição:** Um vendedor pode cadastrar novos clientes em campo como "Prospecção", porém a emissão de pedidos com faturamento a prazo só é liberada após a aprovação e homologação cadastral pelo Supervisor/Gestor no painel Web.
- **Comportamento Esperado:** Clientes prospectados ficam com status *Pendente de Aprovação*. No app mobile, a tentativa de emissão de venda a prazo exibe alerta de restrição cadastral.

### **RN05 — Resolução de Sincronização e Conflitos Offline**
- **Descrição:** Quando o vendedor realiza atendimentos em áreas sem conectividade (modo offline), as operações são armazenadas em fila local com carimbo de data/hora (*timestamp* do momento da ação).
- **Comportamento Esperado:** Ao recuperar a conexão, os eventos são enviados em lote ordenados cronologicamente pelo timestamp da criação local, garantindo que a sequência de check-in $\rightarrow$ auditoria $\rightarrow$ pedido $\rightarrow$ check-out seja preservada no banco remoto.
