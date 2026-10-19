# Requisitos Norteadores (R1–R14) — AXIS

Este documento reúne, para consulta rápida, os **14 requisitos mínimos de complexidade técnica** da Seção 5 do *Documento Norteador do Projeto Integrador — ADS PUC Goiás 2026/2*. Todos são obrigatórios: o não atendimento de qualquer item reduz proporcionalmente a pontuação técnica.

A última coluna indica quais requisitos funcionais (RF), não funcionais (RNF) e regras de negócio (RN) do AXIS atendem a cada item. Ela é a base da *Lista de Verificação de Conformidade Técnica* (Apêndice C do Norteador), entregue na N2.

| Nº | Requisito | Especificação mínima | Onde é atendido no AXIS |
|---|---|---|---|
| **R1** | Múltiplas telas e navegação | Mínimo de 6 telas funcionais distintas, com fluxo de navegação estruturado e coerente com as tarefas do usuário. | RF11, RNF07, telas da seção 3 de funcionais.md |
| **R2** | Autenticação e perfis | Controle de acesso com cadastro e autenticação de usuários, contemplando ao menos 2 perfis com permissões distintas. | RF01, RF02, RF03, RF04, RNF04 |
| **R3** | Operações de manutenção de dados | Operações completas de inclusão, consulta, alteração e exclusão sobre, no mínimo, 2 entidades do domínio, com validação de entrada. | RF05, RF08, RF10, RF13, RF16, RF17, RF21 |
| **R4** | Regras de negócio | Implementação de, no mínimo, 3 regras de negócio não triviais, documentadas e verificáveis na aplicação. | RF09, RF12, RF18, RF21, RF23, RN01–RN05 |
| **R5** | Persistência local | Armazenamento local estruturado no dispositivo, com comportamento definido para situações de ausência de conectividade. | RF14, RNF01 |
| **R6** | Persistência remota | Integração com serviço de retaguarda para armazenamento e sincronização de dados, por API própria ou plataforma de backend como serviço. | RNF01, RNF06 |
| **R7** | Integração externa | Consumo de, no mínimo, 1 serviço ou API externa pertinente ao domínio do projeto. | RF07, RF15, RNF10 |
| **R8** | Recurso nativo do dispositivo | Utilização de, no mínimo, 1 recurso do aparelho (câmera, geolocalização, notificações, armazenamento de arquivos, biometria ou sensores). | RF08, RF12, RF19 |
| **R9** | Consulta e apresentação de dados | Listagens com filtro, ordenação ou busca, e ao menos 1 visão consolidada de dados (resumo, indicador ou gráfico). | RF06, RF11, RF20, RF22, RF24, RF25 |
| **R10** | Tratamento de erros e estados | Tratamento explícito de falhas, mensagens ao usuário e indicação de estados de carregamento e de listas vazias. | RNF02, RNF10 |
| **R11** | Usabilidade e acessibilidade | Aderência às heurísticas de usabilidade, contraste adequado, áreas de toque compatíveis com as diretrizes da plataforma e rótulos para leitores de tela. | RNF03 |
| **R12** | Organização do código | Separação de responsabilidades em camadas, nomenclatura consistente, ausência de credenciais em código-fonte e código livre de trechos comentados sem uso. | RNF04, RNF05, RNF08 |
| **R13** | Versionamento | Repositório Git com histórico distribuído entre os integrantes, mensagens de commit descritivas e README documentando instalação e execução. | [CONTRIBUTING.md](../../CONTRIBUTING.md) |
| **R14** | Distribuição | Geração de pacote instalável (APK ou AAB) e comprovação de execução em dispositivo físico. | RNF07, RNF09 |

> Documentos relacionados: [Requisitos Funcionais](./funcionais.md) · [Requisitos Não Funcionais](./nao-funcionais.md) · [Regras de Negócio](./README.md#regras-de-negócio-não-triviais-rn)
