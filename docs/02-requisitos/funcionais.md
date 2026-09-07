# Requisitos Funcionais — AXIS

Este documento especifica os Requisitos Funcionais (RF) do sistema **AXIS (Account eXecution & Inventory Sales system)**, detalhando o comportamento esperado das funcionalidades no **Painel Web (Gestão)** e no **Aplicativo Mobile (Força de Vendas em Campo)**.

---

## 1. Critérios de Priorização (MoSCoW)

- **Must Have (Obrigatório):** Essencial para o funcionamento do MVP e atendimento aos critérios de aprovação da N1/N2 (Requisitos R1 a R14 do Documento Norteador).
- **Should Have (Importante):** Altamente recomendável, agrega grande valor operacional e deve ser entregue assim que o núcleo estiver funcional.
- **Could Have (Desejável):** Funcionalidade complementar que será implementada caso haja tempo hábil.
- **Won't Have (Fora do Escopo Atual):** Identificado como futuro, não será implementado nesta versão (ex: emissão fiscal, pagamento in-app).

---

## 2. Matriz de Requisitos Funcionais

### Módulo 1: Autenticação, Perfis e Controle de Acesso (R2)

| ID | Nome | Descrição | Plataforma | Prioridade | Requisito Norteador |
|---|---|---|---|---|---|
| **RF01** | Autenticação de Usuário | Permitir que o usuário realize login informando e-mail/matrícula e senha, recebendo token JWT para acesso seguro. | Web / Mobile | **Must** | R2 |
| **RF02** | Controle de Perfis e Permissões | Suportar ao menos 2 perfis de usuário com permissões distintas: **Gestor/Supervisor** (acesso administrativo via Web) e **Vendedor** (acesso restrito às suas rotas, clientes e visitas via Mobile). | Web / Mobile | **Must** | R2 |
| **RF03** | Recuperação e Alteração de Senha | Permitir que o usuário altere sua senha de acesso ou solicite redefinição. | Web / Mobile | **Should** | R2 |
| **RF04** | Encerramento de Sessão (Logout) | Permitir logout seguro invalidando o token localmente e encerrando a sessão ativa. | Web / Mobile | **Must** | R2 |

---

### Módulo 2: Gestão de Clientes e Prospecção em Campo (R3, R7)

| ID | Nome | Descrição | Plataforma | Prioridade | Requisito Norteador |
|---|---|---|---|---|---|
| **RF05** | CRUD de Clientes | Permitir ao gestor cadastrar, consultar, editar e inativar clientes (Razão Social, Nome Fantasia, CNPJ/CPF, Endereço completo, Coordenadas de GPS, Telefone, Contato e Status). | Web | **Must** | R3 |
| **RF06** | Busca e Filtros de Clientes | Permitir listagem de clientes com pesquisa por nome/CNPJ e filtros por região/bairro, status (ativo/inativo) e tipo (carteira/prospecção). | Web / Mobile | **Must** | R9 |
| **RF07** | Autocompletar Endereço por CEP | Integrar com serviço externo de consulta de CEP (ViaCEP / BrasilAPI) para preenchimento automático do logradouro, bairro, cidade e UF durante o cadastro. | Web / Mobile | **Should** | R7 |
| **RF08** | Cadastro de Prospecção em Campo | Permitir que o vendedor em campo cadastre um novo cliente prospectado capturando as coordenadas de GPS do local atual do aparelho. | Mobile | **Must** | R3, R8 |
| **RF09** | Aprovação de Novos Clientes | Permitir que o supervisor avalie e aprove ou rejeite novos clientes cadastrados como prospecção pelos vendedores em campo. | Web | **Should** | R4 |

---

### Módulo 3: Planejamento de Rotas e Execução de Visitas (R1, R3, R4, R5, R8)

| ID | Nome | Descrição | Plataforma | Prioridade | Requisito Norteador |
|---|---|---|---|---|---|
| **RF10** | Planejamento e Atribuição de Rotas | Permitir ao gestor criar uma rota diária/periódica selecionando clientes da carteira e atribuindo-a a um vendedor específico. | Web | **Must** | R3 |
| **RF11** | Visualização da Rota do Dia | Exibir para o vendedor a lista ordenada de visitas programadas para o dia atual com status visual (*Pendente*, *Em Andamento*, *Concluída*, *Não Realizada*). | Mobile | **Must** | R1, R9 |
| **RF12** | Check-in de Visita com Validação GPS | Permitir que o vendedor inicie a visita (Check-in), registrando data, hora e coordenadas de GPS. O sistema deve validar se o vendedor está dentro do raio permitido (ex: 150m) do cliente. | Mobile | **Must** | R4, R8 |
| **RF13** | Check-out com Registro de Desfecho | Permitir finalizar a visita (Check-out) registrando o horário de saída, resumo da visita, desfecho (*Venda Realizada*, *Apenas Auditoria*, *Cliente Fechado*, etc.) e justificativa caso não realizada. | Mobile | **Must** | R3 |
| **RF14** | Operação Offline de Visitas | Permitir o registro de check-in, auditoria e pedidos mesmo sem conexão com a internet, armazenando os dados localmente no dispositivo para sincronização posterior. | Mobile | **Must** | R5 |
| **RF15** | Visualização de Rota no Mapa | Exibir o trajeto e os pontos de visitação do dia sobre um mapa interativo utilizando serviço externo de mapas (Google Maps / Mapbox / OpenStreetMap). | Web / Mobile | **Should** | R7 |

---

### Módulo 4: Inventário e Auditoria de Materiais de PDV (R3, R4, R8)

| ID | Nome | Descrição | Plataforma | Prioridade | Requisito Norteador |
|---|---|---|---|---|---|
| **RF16** | Cadastro do Catálogo de Materiais PDV | Permitir ao gestor cadastrar os materiais de marketing e exposição fornecidos aos clientes (geladeiras, freezers, banners, displays, totens, faixas de gôndola). | Web | **Must** | R3 |
| **RF17** | Controle de Materiais em Comodato por Cliente | Registrar quais materiais de PDV estão alocados em cada cliente, incluindo número de patrimônio/série e data de instalação. | Web | **Must** | R3 |
| **RF18** | Checklist de Auditoria de PDV na Visita | Permitir que o vendedor, durante o atendimento, audite os materiais alocados no cliente, marcando estado de conservação (*Íntegro*, *Avariado*, *Ausente/Extraviado*, *Necessita Manutenção*). | Mobile | **Must** | R4 |
| **RF19** | Registro Fotográfico do Ponto de Venda | Permitir a captura de fotos através da câmera nativa do aparelho para comprovar o estado e a correta aplicação dos materiais no cliente. | Mobile | **Must** | R8 |

---

### Módulo 5: Pedidos de Reposição e Vendas em Campo (R3, R4)

| ID | Nome | Descrição | Plataforma | Prioridade | Requisito Norteador |
|---|---|---|---|---|---|
| **RF20** | Catálogo de Produtos e Tabela de Preços | Exibir listagem de produtos com busca, categorias, fotos, preço unitário e estoque de referência. | Web / Mobile | **Must** | R9 |
| **RF21** | Emissão de Pedido de Venda/Reposição | Permitir que o vendedor selecione produtos, informe quantidades, aplique descontos pré-autorizados e gere o pedido vinculado à visita do cliente. | Mobile | **Must** | R3, R4 |
| **RF22** | Histórico de Pedidos por Cliente | Permitir consulta ao histórico de pedidos anteriores realizados por aquele cliente para auxiliar na sugestão de reposição. | Web / Mobile | **Should** | R9 |

---

### Módulo 6: Gestão de Metas e Painel de Indicadores (R4, R9)

| ID | Nome | Descrição | Plataforma | Prioridade | Requisito Norteador |
|---|---|---|---|---|---|
| **RF23** | Parametrização de Metas Comerciais | Permitir ao gestor cadastrar metas mensais/semanais por vendedor, combinando indicadores ponderados (Volume Financeiro de Vendas, Quantidade de Visitas Realizadas e Clientes Novos Prospectados). | Web | **Must** | R4 |
| **RF24** | Dashboard Gerencial Consolidado | Exibir no painel Web gráficos e cartões com indicadores consolidados (taxa de visitas realizadas vs planejadas, faturamento do período, ranking de vendas e mapa de calor de cobertura). | Web | **Must** | R9 |
| **RF25** | Acompanhamento Individual de Metas | Exibir no aplicativo mobile uma tela de resumo do vendedor com a porcentagem de atingimento de suas metas no ciclo corrente. | Mobile | **Should** | R9 |

---

## 3. Telas Mínimas Mapeadas no Aplicativo Mobile (Atendimento ao Requisito R1)

Para cumprir a exigência do **Requisito R1** (mínimo de 6 telas funcionais com fluxo coerente):

1. **Tela 1 — Login / Autenticação:** Acesso seguro com e-mail e senha.
2. **Tela 2 — Home / Rota do Dia:** Visão geral da jornada de trabalho e listagem das visitas do dia com status.
3. **Tela 3 — Detalhe do Cliente & Check-in:** Informações do cliente, mapa, histórico e ação de início de atendimento validada via GPS.
4. **Tela 4 — Auditoria de PDV / Inventário:** Checklist dos materiais alocados no cliente com upload/captura de foto pela câmera.
5. **Tela 5 — Novo Pedido de Reposição / Venda:** Catálogo de produtos, carrinho, cálculo de totais e finalização do pedido.
6. **Tela 6 — Cadastro de Nova Prospecção:** Formulário de captação de novo cliente em campo com captura de coordenadas geográficas.
7. **Tela 7 (Bônus) — Minhas Metas & Histórico:** Visão consolidada do progresso individual do vendedor no mês.
