# Auditoria Playwright do fluxo de artigos — 2026-10-07

## Escopo

Auditoria funcional e visual executada em um projeto descartável, sem usar ou alterar o projeto 7. O cenário criou 25 registros, incluindo um par duplicado, e percorreu identificação, triagem, elegibilidade, inclusão, extração e navegação do projeto.

## Percurso verificado

| Etapa | Verificação | Saúde |
| --- | --- | --- |
| 1 | Identificação mostra total global, 20 registros por página, navegação de páginas e ação em massa protegida por confirmação. | Saudável |
| 2 | Promoção envia os 23 registros únicos e mantém o grupo duplicado para revisão. | Saudável |
| 3 | Triagem usa o total completo da fila, remove excluídos da fila ativa e permite copiar e editar a justificativa da IA antes de salvar. | Saudável |
| 4 | Elegibilidade exige PDF, mantém excluídos fora da fila ativa e encaminha inclusões corretamente. | Saudável |
| 5 | Extração mantém o formulário montado ao alternar entre PDF e Notas, salva notas e confirma a conclusão antes de alterar o estado. | Saudável |
| 6 | Próximo/anterior preserva `flow=included&workspace=extracao`. | Saudável |
| 7 | Visão Geral, Planejamento, Artigos, Fluxo, Síntese e Gráficos respondem ao primeiro clique e ao histórico voltar/avançar. | Saudável |
| 8 | Cabeçalho autenticado, avatar/menu da conta e breadcrumbs permanecem presentes nas áreas internas. | Saudável |

## Leitura visual

- O painel de fila desktop tem altura compacta, rolagem interna e paginação fixa no rodapé; a página não cresce conforme o número total de registros.
- O badge da etapa e o rodapé distinguem o total global da quantidade exibida (`20 exibidos de 25`, `Página 1 de 2`).
- O detalhe do artigo usa apenas um título `Resumo`.
- O cabeçalho, breadcrumbs e controles de conta mantêm a mesma linguagem visual entre projeto e workspace focado.
- Em largura de 1024 px, o workspace de extração reorganiza os painéis sem perder ações ou campos.

## Evidências

- `01-identification-paginated.png`: identificação compacta, total e paginação.
- `02-screening-full-total.png`: triagem com total global e fila ativa.
- `03-extraction-desktop.png`: extração em desktop, PDF/Notas e formulário persistente.
- `04-extraction-narrow.png`: reorganização responsiva da extração.
- `05-project-navigation-narrow.png`: navegação interna, breadcrumbs e conta autenticada.

## Limites da rodada

- O PDF usado no teste é um arquivo sintético mínimo; a auditoria valida upload, disponibilidade e estabilidade do workspace, não fidelidade de renderização de um documento científico real.
- Foram verificadas semântica acessível dos controles usados pelo Playwright, foco dos diálogos e operação por nomes acessíveis. Uma auditoria completa com leitor de tela e contraste automatizado não fez parte desta rodada.
- A integração real do OAuth Google depende do Client ID e dos domínios autorizados no Google Cloud quando `synapse.labit.dev.br` estiver registrado.
