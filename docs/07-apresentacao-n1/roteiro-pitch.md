# Guia e Roteiro de Apresentação — Pitch Banca de Qualificação N1
**Projeto Integrador — ADS | PUC Goiás (2026/2)**  
**Tema:** AXIS — Account eXecution & Inventory Sales system  
**Equipe:** Guilherme Breder (Frontend), Douglas Cavalcanti (Backend), João Victor Castro (Mobile)  
**Tempo Estimado de Apresentação:** 5 a 6 minutos (com espaço para arguição da banca)

---

## 📌 Orientações Gerais para o Pitch no MS Teams

1. **Objetivo da Banca:** Validar a maturidade da ideia, se a equipe tem clareza do problema que resolve e se o escopo mobile atende às exigências da disciplina.
2. **Postura:** Fale com calma e segurança. Não leia slides cheios de texto — os slides contêm apenas tópicos-chave e imagens dos protótipos, enquanto o que você fala agrega valor.
3. **Divisão de Apresentação:**
   - **Formato Sugerido:** Guilherme conduz a abertura, problema e protótipos (Frontend/UI/UX), Douglas e João comentam a arquitetura/regras de negócio ou ficam a postos para responder às perguntas técnicas da banca.

---

## 🖥️ Estrutura Slide a Slide (Google Apresentações)

---

### Slide 1: Capa
- **Título do Slide:** **AXIS**
- **Subtítulo:** *Account eXecution & Inventory Sales system*
- **Tópicos no Slide:**
  - Sistema de Gestão de Força de Vendas Externa e Inventário de PDV
  - Equipe: Douglas Cavalcanti | Guilherme Breder | João Victor Castro
  - Orientação: Prof. Dr. Rafael Leal Martins | PUC Goiás 2026/2
- **⏱️ Tempo:** ~30 segundos
- **🗣️ Roteiro de Fala (Script do Orador):**
  > *"Boa noite, professores e banca examinadora. Hoje estamos aqui para apresentar a proposta do projeto **AXIS**, o nosso sistema de gestão e execução de vendas em campo com controle de inventário para pequenos e médios distribuidores e indústrias. Nossa equipe é composta pelo Douglas no backend, João Victor no mobile e eu, Guilherme, no frontend. Vamos demonstrar o problema que resolvemos, nossos objetivos e os protótipos das funcionalidades centrais."*

---

### Slide 2: O Problema & Justificativa *(Exigência da Banca: Justificativa)*
- **Título do Slide:** **O Desafio da Força de Vendas em Campo**
- **Destaques Visuais / Tópicos:**
  - ❌ **"Apagão" de Visibilidade:** Gestores não sabem se a visita realmente aconteceu ou qual rota foi feita.
  - ❌ **Materiais de Exposição Abandonados:** Empresas investem em displays, freezers e banners que são extraviados ou danificados nos clientes.
  - ❌ **Processos Manuais e Lentos:** Apontamentos em cadernos, WhatsApp e planilhas atrasam o faturamento e geram retrabalho.
- **⏱️ Tempo:** ~50 segundos
- **🗣️ Roteiro de Fala (Script do Orador):**
  > *"No cenário comercial de pequenas e médias distribuidoras, a maior parte do faturamento vem do vendedor externo visitando mercadinhos, padarias e pontos de venda. No entanto, existe um verdadeiro 'apagão de dados': o gestor comercial depende de mensagens de WhatsApp e relatos manuais para saber se o vendedor esteve mesmo no cliente. Além disso, as empresas colocam materiais caros em comodato — como freezers, totens e displays — e perdem completamente o controle de integridade desses ativos. O AXIS nasce para transformar esse processo empírico em uma operação transparente, rastreável e orientada a dados."*

---

### Slide 3: Proposta de Valor & Objetivos *(Exigência da Banca: Objetivos)*
- **Título do Slide:** **Objetivos da Solução: AXIS**
- **Destaques Visuais / Tópicos:**
  - 🎯 **Para o Vendedor em Campo (App Mobile):**
    - Rota do dia organizada e navegação ágil
    - Check-in georreferenciado e operação offline-first
    - Auditoria fotográfica de PDV e emissão de pedidos
  - 🎯 **Para a Gestão Comercial (Painel Web):**
    - Acompanhamento de rotas e visitas em tempo real
    - Controle patrimonial de materiais alocados
    - Dashboards de atingimento de metas consolidadas
- **⏱️ Tempo:** ~50 segundos
- **🗣️ Roteiro de Fala (Script do Orador):**
  > *"Nosso objetivo geral é fornecer uma solução integrada em duas frentes complementares: um **aplicativo móvel**, leve e focado na agilidade do vendedor durante a sua jornada externa, operando inclusive sem internet; e um **painel web gerencial**, que centraliza o planejamento de rotas, inventário de materiais e indicadores de desempenho. Nosso foco é aumentar a produtividade do vendedor e dar ao gestor a segurança de que o plano de visitas está sendo cumprido com comprovação física e digital."*

---

### Slide 4: Arquitetura & Tecnologias
- **Título do Slide:** **Pilha Tecnológica & Arquitetura**
- **Destaques Visuais / Tópicos:**
  - 📱 **Mobile:** React Native (Expo) + SQLite / AsyncStorage (Persistência Offline)
  - 🌐 **Web:** React + TypeScript + Vite + TailwindCSS
  - ⚙️ **Backend:** Node.js + TypeScript + REST API + PostgreSQL
  - 🗺️ **Serviços Externos & Hardware:** GPS nativo (Geolocalização), Câmera nativa e APIs de Mapas/CEP
- **⏱️ Tempo:** ~40 segundos
- **🗣️ Roteiro de Fala (Script do Orador):**
  > *"Tecnicamente, adotamos uma arquitetura robusta e em camadas: o aplicativo mobile está sendo construído em React Native com foco em suporte offline, utilizando banco local para armazenar visitas caso não haja sinal 4G. O backend é em Node.js com TypeScript e banco relacional, garantindo integridade de regras. E o painel de gestão web em React para acompanhamento dos coordenadores. Fazemos uso direto de recursos nativos do aparelho celular, como GPS de alta precisão e câmera para auditoria fotográfica."*

---

### Slide 5: Protótipo Móvel — Rota do Dia & Check-in GPS *(Exigência da Banca: Protótipos)*
- **Título do Slide:** **Protótipo: Rota do Dia & Check-in Georreferenciado**
- **Elemento Visual:** *[Inserir imagem da Tela de Rotas e Check-in]*
- **Destaques no Slide:**
  - Lista sequencial de clientes com status visual (*Pendente, Em Andamento, Concluída*)
  - Validação de raio de proximidade (**Geofencing a 20 metros**)
  - Registro de horário e coordenadas de início e término de atendimento
- **⏱️ Tempo:** ~1 minuto
- **🗣️ Roteiro de Fala (Script do Orador):**
  > *"Aqui temos o protótipo da tela central do vendedor: a **Rota do Dia**. O profissional abre o aplicativo e já visualiza a sequência de estabelecimentos a visitar. Ao chegar no cliente, o app captura a geolocalização do dispositivo e valida nossa primeira regra de negócio não trivial: o **Geofencing**. O sistema só permite o check-in se o vendedor estiver a um raio de até 20 metros do ponto cadastrado. Caso haja divergência física ou de sinal, o sistema exige uma justificativa com auditoria para o gestor. Isso elimina visitas fictícias de forma simples e transparente."*

---

### Slide 6: Protótipo Móvel — Auditoria de PDV & Pedidos de Reposição
- **Título do Slide:** **Protótipo: Auditoria de Materiais & Venda em Campo**
- **Elemento Visual:** *[Inserir imagem da Tela de Auditoria com Câmera e Carrinho de Pedidos]*
- **Destaques no Slide:**
  - Checklist dos materiais em comodato por cliente (Ex: freezer, banner)
  - Comprovação fotográfica obrigatória via câmera do celular
  - Catálogo de produtos para emissão ágil de pedidos de reposição
- **⏱️ Tempo:** ~1 minuto
- **🗣️ Roteiro de Fala (Script do Orador):**
  > *"Durante o atendimento, o vendedor executa a auditoria de PDV: o app lista os materiais que estão sob a posse daquele cliente. O vendedor checa a conservação — se está íntegro, quebrado ou extraviado — e registra uma foto comprobatória pelo recurso de câmera nativa. Na mesma visita, se o cliente precisar repor mercadorias, o vendedor acessa o catálogo integrado, monta o pedido de venda e finaliza o atendimento com o check-out. Todos esses dados são sincronizados automaticamente com o servidor ou guardados localmente se estiver sem sinal."*

---

### Slide 7: Painel de Indicadores & Metas Ponderadas
- **Título do Slide:** **Indicadores de Gestão & Metas da Equipe**
- **Elemento Visual:** *[Inserir imagem do Dashboard / Metas]*
- **Destaques no Slide:**
  - Métrica ponderada de metas: 50% Faturamento, 30% Visitas, 20% Prospecção
  - Taxa de conversão de visitas e cobertura geográfica da carteira
  - Visibilidade em tempo real para tomada de decisão
- **⏱️ Tempo:** ~40 segundos
- **🗣️ Roteiro de Fala (Script do Orador):**
  > *"Para fechar o ciclo da gestão, o painel consolida os indicadores em tempo real. Implementamos o cálculo dinâmico de metas ponderadas, combinando faturamento financeiro, disciplina de visitas cumpridas e prospecção de novos clientes. Dessa forma, a gestão comercial tem visibilidade precisa de quem está performando bem em campo e onde estão os gargalos da operação."*

---

### Slide 8: Conclusão & Próximos Passos
- **Título do Slide:** **Próximos Passos & Entrega**
- **Destaques no Slide:**
  - ✅ **Fase Atual (N1):** Requisitos detalhados, regras de negócio e prototipação de telas concluídas.
  - 🚀 **Próxima Fase (N2):** Implementação em camadas, persistência offline com SQLite, validação de APK em dispositivo físico real e testes de usabilidade com usuários.
  - 👥 Obrigado! Aberto para dúvidas da banca examinadora.
- **⏱️ Tempo:** ~30 segundos
- **🗣️ Roteiro de Fala (Script do Orador):**
  > *"Com a especificação de requisitos concluída e os fluxos de tela validados, nosso próximo ciclo focará na codificação das camadas de persistência e na geração do APK para testes em aparelhos físicos reais com usuários externos. Estamos muito confiantes no valor prático do AXIS e agora ficamos à disposição da banca para dúvidas e considerações. Muito obrigado!"*

---

## ❓ Possíveis Perguntas da Banca e Como Responder

1. **"Por que não fazer só um site responsivo em vez de um app nativo/mobile?"**
   - **Resposta:** *"Porque o vendedor passa o dia na rua, onde a conexão de internet é frequentemente instável ou inexistente. Uma página web não garante a persistência offline confiável que o SQLite/AsyncStorage móvel proporciona, além de o app ter acesso de baixo nível aos sensores de GPS e câmera nativa em segundo plano."*

2. **"Como vocês garantem que o vendedor não vai burlar a geolocalização (Fake GPS)?"**
   - **Resposta:** *"No mobile capturamos as flags de Mock Location da API do dispositivo. Além disso, combinamos a geolocalização com a auditoria fotográfica no ponto de venda e o registro exato de timestamp."*

3. **"Qual foi o critério para definir o raio de 20 metros no check-in?"**
   - **Resposta:** *"O raio de 20 metros garante que o vendedor esteja fisicamente na calçada ou dentro da loja do cliente. Caso o sinal de GPS esteja impreciso devido a prédios ou coberturas metálicas, o aplicativo oferece um fluxo alternativo onde ele pode registrar uma justificativa formal com foto, que é sinalizada para o supervisor."*
