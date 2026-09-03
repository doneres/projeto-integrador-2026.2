# Visão e Escopo do Projeto

## 1. Objetivo

Desenvolver um sistema de gestão de força de vendas externa que dê visibilidade real à gestão comercial sobre o trabalho do vendedor em campo — rotas, visitas, inventário de materiais de ponto de venda (PDV) e cumprimento de metas — enquanto oferece ao vendedor uma ferramenta ágil para executar seu dia de trabalho.

## 2. Problema

Em empresas de pequeno/médio porte com equipe de vendas externa, o vendedor passa a maior parte do tempo fora da empresa, prospectando novos clientes e visitando a carteira já fechada. Isso gera falta de visibilidade para coordenadores, supervisores e diretores sobre:

- Se a visita ao cliente realmente aconteceu
- Qual rota o vendedor percorreu
- Se os materiais de exposição da empresa no cliente (geladeiras, posters, banners, materiais de marketing) estão presentes, íntegros ou precisando de reposição
- Se as metas comerciais estão sendo cumpridas

## 3. Justificativa

Sem um sistema estruturado, o acompanhamento da equipe externa depende de relatos informais, planilhas manuais ou ligações — processos sujeitos a erro, atraso e falta de dados confiáveis para tomada de decisão.

## 4. Declaração de Visão

> Para **coordenadores, supervisores e diretores comerciais** de empresas com equipe de vendas externa, que **precisam acompanhar rotas, visitas e metas de seus vendedores em campo**, o **[Nome do Projeto]** é um **sistema de gestão de força de vendas** que **oferece visibilidade em tempo real das visitas, inventário de PDV e desempenho comercial**. Diferente de controles manuais (planilhas, ligações, relatos informais), o sistema **automatiza a comprovação de visita via geolocalização, otimiza rotas e centraliza indicadores em um único painel**.

## 5. Público-Alvo / Atores

| Ator | Papel no sistema |
|---|---|
| Vendedor | Executa a rota, faz check-in, atualiza inventário, registra vendas e prospecções — via mobile |
| Coordenador/Supervisor | Gerencia clientes, monta rotas, aprova prospecções, acompanha a equipe — via web |
| Diretor | Acompanha indicadores e metas consolidadas — via web |
| Administrador | Realiza cadastros gerais e parametrizações do sistema — via web |

## 6. Escopo do Projeto

### Dentro do escopo

- Cadastro e gestão de clientes (contrato e prospecção)
- Geração de rotas otimizadas para os vendedores
- Check-in/check-out de visita via geolocalização (mobile)
- Inventário de materiais de PDV por cliente
- Definição e acompanhamento de metas (múltiplos indicadores combinados)
- Registro de vendas de reposição durante a visita
- Painel web com relatórios e indicadores em tempo real
- Fluxo de aprovação de novos clientes prospectados em campo

### Fora do escopo

- Integração com ERP financeiro/faturamento
- Emissão de nota fiscal
- Pagamentos/cobranças dentro do app
- Gestão de estoque centralizado da empresa (o inventário tratado aqui é o de materiais alocados no cliente, não o estoque interno)

## 7. Restrições e Premissas

- Stack definida: Node.js + TypeScript (backend), React + TypeScript (web), React Native (mobile)
- O check-in depende da geolocalização do dispositivo mobile do vendedor
- O sistema deve considerar conectividade instável em campo (vendedor pode estar sem sinal durante parte do trajeto)
- Projeto desenvolvido em contexto acadêmico (PUC Goiás, 2026.2), com prazo e entregas alinhados ao cronograma da disciplina

## 8. Stakeholders

| Nome | Papel |
|---|---|
| Douglas, João Victor e Guilherme | Desenvolvimento |
| 	
ANIBAL VICENTE VIEIRA | Avaliação/orientação |