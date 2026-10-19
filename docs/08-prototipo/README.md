# Protótipo Navegável — App Mobile (Vendedor)

Protótipo de média fidelidade do fluxo principal do vendedor em campo, feito no Figma.

- **Protótipo navegável (modo apresentação):** [abrir no Figma](https://www.figma.com/proto/afLUDMykyDSzffOKGYdArV/AXIS?node-id=16-2&starting-point-node-id=16%3A2)
- **Arquivo de design:** [abrir no Figma](https://www.figma.com/design/afLUDMykyDSzffOKGYdArV/AXIS)
- **Autor:** Guilherme Breder

## Telas

| Tela | O que mostra | Requisitos relacionados |
|---|---|---|
| Login | Acesso por e-mail ou matrícula e senha | RF01 |
| Rota do Dia | Resumo das visitas por status e lista de clientes do dia com distância | RF11 |
| GPS Check-in | Prévia do mapa com geofence de 20 m, precisão do GPS e status *No Local* | RF12, RN01 |
| Inventário PDV | Checklist dos equipamentos em comodato, status de cada item e foto obrigatória | RF18, RF19, RN03 |

## Fluxo de navegação

O fluxo começa no Login (ponto de partida "Fluxo do vendedor").

| Ação | Destino |
|---|---|
| **Entrar** | Rota do Dia |
| **Iniciar Atendimento** ou primeiro card de cliente | GPS Check-in |
| **Confirmar Check-in** | Inventário PDV |
| **Finalizar Vistoria** | Rota do Dia (fim do ciclo da visita) |
| Seta **‹** no topo | Tela anterior |

## Limitações conhecidas

- Os botões secundários (Esqueci minha senha, Recalcular rota, Usar câmera, Galeria, Revisar pendências) ainda não têm destino no protótipo.
- As telas web (painel de gestão) não estão neste protótipo; elas são desenhadas e construídas diretamente no código do painel.
