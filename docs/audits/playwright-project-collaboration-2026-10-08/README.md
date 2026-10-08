# Auditoria Playwright — colaboração em projetos

**Data:** 2026-10-08  
**Viewports:** desktop Chromium (1280 × 720) e Pixel 7 (412 × 839 CSS px)  
**Escopo:** convite interno, distribuição, revisão cega, arbitragem, fila pessoal, acesso somente leitura e notificações.

## Roteiro verificado

1. Projeto individual: prévia com uma vaga por artigo e decisão legada preservada.
2. Convites: associação imediata de contas existentes e aceite de convite pendente pela fixture de autenticação.
3. Distribuição: três revisores, duas pessoas distintas por artigo, equilíbrio de carga e repetição idempotente.
4. Revisão cega: primeira decisão privada, segunda submissão obrigatória e bloqueio de reenvio.
5. Consolidação: concordância avança o artigo e mantém a dupla na elegibilidade.
6. Discordância: conflito aberto, justificativa obrigatória e arbitragem por coordenador.
7. Fila pessoal: total calculado no servidor, paginação e filtro `Atribuídos a mim`.
8. Permissões: leitura global preservada; decisão, notas, extração, PDF, edição e remoção retornam 403 para revisor sem atribuição.
9. Notificações: leitura individual, leitura em lote, contador, destino navegável e aviso de conflito resolvido.
10. Mudança de equipe: remoção invalida a prévia, marca vagas para reatribuição e permite selecionar novo revisor.

## Evidências visuais

Cada estado abaixo possui a versão `desktop-chromium-*` e `mobile-chromium-*` nesta pasta:

- `01-team-overview.png`
- `02-invitation-dialog.png`
- `03-distribution-preview.png`
- `04-reviewer-blind-waiting.png`
- `05-conflict-resolution.png`
- `06-assigned-to-me.png`
- `07-unassigned-read-only.png`
- `08-notification-panel.png`

## Resultado da inspeção

- A hierarquia visual, contraste dos estados, modais, foco funcional e ações primárias ficaram coerentes nos dois viewports.
- O painel sem atribuição comunica “Somente leitura” e mantém a ação de decisão visível, porém desabilitada, com explicação contextual.
- A captura do painel de notificações passou a aguardar a animação de abertura; não há transparência ou conteúdo sobreposto na evidência final.
- “Abstract / Resumo” foi substituído por “Resumo”, e os textos auxiliares do visualizador de PDF foram revisados para português com acentuação.
- Os cards da fila móvel passaram a mover status, data e menu para uma linha própria, preservando título e metadados.
- A marca das páginas internas foi alinhada para `Synapse`, como link de retorno ao início, sem ícone alternativo de produto.
- Não houve overflow horizontal da página, erros de console ou exceções do navegador no cenário colaborativo.

## Limites conhecidos da evidência

- O teste automatiza teclado nos componentes por seus testes de unidade e valida foco/fechamento dos diálogos, mas não substitui uma auditoria manual completa com leitor de tela.
- Neo4j e Qdrant não são necessários para as regras colaborativas e permaneceram indisponíveis no ambiente local; as falhas toleradas de sincronização não geraram erro na interface nem alteraram o PostgreSQL, que é a fonte de verdade deste fluxo.
