# Requisitos Não Funcionais — AXIS

Este documento especifica os Requisitos Não Funcionais (RNF) do sistema **AXIS (Account eXecution & Inventory Sales system)**, organizados por atributos de qualidade de software segundo a norma ISO/IEC 25010 e em total conformidade com os requisitos técnicos do Documento Norteador (R1 a R14).

---

## 1. Tabela de Requisitos Não Funcionais

| ID | Categoria | Descrição | Métrica / Critério de Aceite | Requisito Norteador |
|---|---|---|---|---|
| **RNF01** | Confiabilidade / Offline | O aplicativo mobile deve operar em modo **Offline-First**, permitindo registrar check-ins, auditorias de PDV e pedidos mesmo sem conexão com a internet. | Os dados devem ser persistidos localmente (AsyncStorage / SQLite) e sincronizados automaticamente com a API assim que a conexão for restabelecida. | R5, R6 |
| **RNF02** | Usabilidade / Estados de Interface | A interface deve fornecer feedback visual imediato em todas as ações do usuário (indicadores de carregamento *loaders*, mensagens de erro descritivas, banners de status offline e *empty states* amigáveis). | Nenhuma tela deve permanecer estática ou sem resposta visual durante requisições de rede ou em listas vazias. | R10 |
| **RNF03** | Acessibilidade / UI | A interface do aplicativo e do painel web deve seguir as diretrizes de acessibilidade e heurísticas de usabilidade (contraste mínimo WCAG AA 4.5:1, áreas de toque mínimas de 48x48 dp para botões e rótulos para leitores de tela). | Conformidade com as diretrizes de acessibilidade da plataforma Android (TalkBack) e Web. | R11 |
| **RNF04** | Segurança / Autenticação | Todas as comunicações entre clientes (Web/Mobile) e o Backend devem ser autenticadas via tokens **JWT (JSON Web Token)** transmitidos via cabeçalho HTTP `Authorization: Bearer`. | Senhas armazenadas no banco de dados devem utilizar hash criptográfico forte com salt (ex: `bcrypt` com custo $\ge 10$). | R2, R12 |
| **RNF05** | Segurança / Credenciais | Nenhuma credencial de banco de dados, chaves secretas de JWT ou tokens de APIs externas podem ser commitados no repositório de código-fonte. | Uso obrigatório de variáveis de ambiente gerenciadas via arquivos `.env` e `.env.example`. | R12 |
| **RNF06** | Desempenho / Resposta | O tempo de resposta das consultas da API REST do backend não deve exceder **500 ms** em condições normais de rede local. | 95% das requisições devem responder dentro do limite em ambiente de teste/homologação. | R6 |
| **RNF07** | Desempenho / Carga Mobile | O aplicativo mobile deve inicializar e exibir a tela inicial (Home/Rotas) em menos de **3 segundos** em dispositivos móveis compatíveis. | Medição de tempo de renderização no dispositivo de teste físico. | R1, R14 |
| **RNF08** | Manutenibilidade / Arquitetura | O código-fonte deve ser modular e organizado em camadas bem definidas de responsabilidade (Controllers, Services, Repositories/Model no backend; Components, Screens, Hooks, Services no Frontend/Mobile). | Nomenclatura consistente, separação estrita de regras de negócio da camada visual e ausência de código morto/comentado. | R12 |
| **RNF09** | Portabilidade / Dispositivo | O aplicativo mobile deve ser compatível e executável em smartphones com sistema operacional **Android 8.0 (Oreo / API 26) ou superior**. | Comprovação de geração de pacote instalável (**APK / AAB**) e teste em aparelho físico real. | R14 |
| **RNF10** | Integrações Externas / Tolerância | A aplicação deve tratar falhas e indisponibilidades das APIs externas integradas (Geocodificação/Mapas e consulta de CEP), não travando o fluxo caso o serviço externo falhe. | Timeout configurado para no máximo 5 segundos com fallback para preenchimento manual de endereço caso o serviço falhe. | R7, R10 |
