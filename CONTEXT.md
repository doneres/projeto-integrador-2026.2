# AXIS

Gestão de força de vendas externa: vendedores visitam clientes em campo, e a equipe de gestão planeja rotas, acompanha metas e audita os pontos de venda.

## Language

### Perfis

**Vendedor**:
Pessoa que atende clientes em campo pelo aplicativo móvel.
_Avoid_: Representante

**Coordenador**:
Gestor de uma equipe: monta rotas, aprova prospecções e gerencia os clientes dos seus vendedores.
_Avoid_: Supervisor, gestor

**Diretor**:
Define as metas dos vendedores e acompanha o consolidado de todas as equipes.
_Avoid_: Gestor

**Administrador**:
Cria contas, define perfis e ajusta os parâmetros do sistema.
_Avoid_: Admin, superusuário

**Equipe**:
Um Coordenador e os Vendedores vinculados a ele.
_Avoid_: Time, carteira

### Visita

**Rota**:
Conjunto ordenado de Visitas de um Vendedor em um dia, montado pelo Coordenador a partir dos Clientes da Equipe.
_Avoid_: Roteiro

**Visita**:
Atendimento planejado de um Vendedor a um Cliente dentro de uma Rota, aberta pelo Check-in e encerrada pelo Check-out. Nasce Pendente, fica Em andamento após o Check-in e termina Concluída ou Não realizada conforme o Desfecho.
_Avoid_: Atendimento

**Desfecho**:
Resultado registrado no Check-out: Venda Realizada, Apenas Auditoria, Cliente Fechado ou Não Realizada. Os dois últimos exigem justificativa.

**Check-in**:
Abertura da Visita, com a localização do Vendedor comparada à do Cliente.
_Avoid_: Chegada

**Check-out**:
Encerramento da Visita, com desfecho registrado.
_Avoid_: Saída

**No Local**:
Situação de um Check-in feito dentro do raio permitido do Cliente.

**Fora do Raio**:
Situação de um Check-in feito além do raio permitido, aceito apenas com justificativa e sinalizado ao Coordenador e ao Diretor.

**Flag de auditoria**:
Sinal que marca uma Visita Fora do Raio para revisão pela gestão.
_Avoid_: Alerta

### Clientes e pontos de venda

**Cliente**:
Estabelecimento atendido pelos Vendedores de uma Equipe e gerenciado pelo Coordenador dela. Tem localização obrigatória, informada pelo Coordenador (ou capturada pelo GPS do Vendedor, no caso da Prospecção).
_Avoid_: Loja, PDV

**Cliente de carteira**:
Cliente cadastrado pelo Coordenador, ativo desde o cadastro. Contrasta com a Prospecção.

**Inativo**:
Estado de um Cliente que deixou de ser atendido: não entra em rota nem recebe Pedido, mas permanece no histórico. Cliente nunca é excluído.

**Prospecção**:
Cliente novo cadastrado em campo pelo Vendedor, que só existe plenamente após a aprovação do Coordenador.
_Avoid_: Lead

**Pendente de aprovação**:
Estado de uma Prospecção ainda não avaliada: não entra em rota, não recebe Visita nem Pedido.

**Rejeitada**:
Estado de uma Prospecção recusada pelo Coordenador, mantida no histórico com o motivo.

**Material de PDV**:
Tipo de equipamento do ponto de venda mantido no catálogo do Administrador, como geladeira ou display.
_Avoid_: Ativo, equipamento

**Comodato**:
Cessão de um item físico de Material de PDV a um Cliente, com número de patrimônio ou série e data de instalação. Segue ativo até o Administrador encerrá-lo.
_Avoid_: Empréstimo, alocação

**Auditoria de PDV**:
Conferência, durante a Visita, do Estado de conservação de cada Comodato ativo do Cliente.
_Avoid_: Inventário, checklist

**Estado de conservação**:
Resultado da Auditoria de PDV para um Comodato: Íntegro, Avariado, Ausente ou Necessita Manutenção. Registra o que o Vendedor viu; não altera o Comodato.

**Foto**:
Registro fotográfico tirado durante a Visita para comprovar o estado do ponto de venda, ligado à Visita e, quando for o caso, ao item auditado.
_Avoid_: Imagem

### Produtos e pedidos

**Produto**:
Item do catálogo do Administrador, com preço unitário e estoque de referência.

**Pedido**:
Compra de reposição emitida pelo Vendedor durante uma Visita, com o preço do Produto congelado na emissão. Conta no faturamento desde a emissão; não há status, cancelamento nem desconto.
_Avoid_: Venda

### Metas

**Meta**:
Alvos mensais de um Vendedor, definidos pelo Diretor, em faturamento, visitas realizadas e novos clientes.

**Score**:
Percentual de 0 a 100% que resume o atingimento das Metas do mês.
_Avoid_: Nota, pontuação

**Visita realizada**:
Visita Concluída: com Check-in e Check-out e Desfecho Venda Realizada ou Apenas Auditoria. Cliente Fechado e Não Realizada deixam a Visita como Não realizada e não contam na Meta.

**Novo cliente**:
Prospecção aprovada pelo Coordenador, contada no mês da aprovação.

### Sistema

**Parâmetros do sistema**:
Valores ajustados pelo Administrador: o raio do Check-in e os pesos do Score (faturamento, visitas e novos clientes, somando 100%).
