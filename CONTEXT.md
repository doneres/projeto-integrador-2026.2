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

**Visita**:
Atendimento de um Vendedor a um Cliente, aberta pelo Check-in e encerrada pelo Check-out.
_Avoid_: Atendimento

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
Estabelecimento atendido pelos Vendedores.
_Avoid_: Loja, PDV

**Prospecção**:
Cliente novo cadastrado em campo pelo Vendedor, que só existe plenamente após a aprovação do Coordenador.
_Avoid_: Lead

**Pendente de aprovação**:
Estado de uma Prospecção ainda não avaliada: não entra em rota, não recebe Visita nem Pedido.

**Rejeitada**:
Estado de uma Prospecção recusada pelo Coordenador, mantida no histórico com o motivo.

**Material de PDV**:
Equipamento do ponto de venda cedido ao Cliente em comodato, como geladeira ou display.
_Avoid_: Ativo, equipamento

**Auditoria de PDV**:
Conferência, durante a Visita, do estado de cada Material de PDV do Cliente.
_Avoid_: Inventário, checklist

### Metas

**Meta**:
Alvos mensais de um Vendedor, definidos pelo Diretor, em faturamento, visitas realizadas e novos clientes.

**Score**:
Percentual de 0 a 100% que resume o atingimento das Metas do mês.
_Avoid_: Nota, pontuação

**Visita realizada**:
Visita com Check-in e Check-out cujo desfecho não é Não Realizada.

**Novo cliente**:
Prospecção aprovada pelo Coordenador, contada no mês da aprovação.
