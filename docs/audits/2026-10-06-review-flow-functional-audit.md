# Auditoria funcional do fluxo de revisão

Data: 6 de outubro de 2026

## Escopo

Fluxo real entre Identificação, Triagem, Elegibilidade e Inclusão, incluindo seleção em lote, decisões de inclusão e exclusão, passagem sem decisão, upload de PDF, checklist de elegibilidade e chegada ao corpus final.

O teste automatizado cria um projeto isolado com três artigos e o remove ao final. Nenhum projeto real é alterado.

## Veredito após as correções

O percurso principal está funcional e coerente. O teste completo passou em Chromium, sem erros de console: dois artigos foram enviados à triagem, um foi excluído, outro avançou, recebeu PDF e chegou à inclusão. A auditoria geral também passou em desktop e mobile.

## Melhorias verificadas

1. **Identificação e lote.** O CTA fica desabilitado sem seleção, mostra a quantidade selecionada e existe “selecionar todos os artigos visíveis”. Evidências: [início](playwright-review-flow-2026-10-06/desktop-chromium-01-identification-start.png) e [seleção](playwright-review-flow-2026-10-06/desktop-chromium-02-identification-selected.png).
2. **Seleção sem ambiguidade.** Checkboxes aparecem apenas na Identificação, onde existe ação em lote. Nas demais etapas, o clique no conteúdo da linha abre o artigo e o menu de ações é um controle separado.
3. **Triagem.** Artigos sem decisão aparecem como “Pendente”; sugestão da IA não se confunde com decisão humana. “Pular por agora” abre o próximo item sem alegar que uma decisão foi gravada. Evidência: [triagem](playwright-review-flow-2026-10-06/desktop-chromium-03-screening-after-promotion.png).
4. **Estado sempre atual.** O painel deriva o artigo selecionado da coleção recém-carregada. Exclusões e upload de PDF deixam de manter uma cópia obsoleta na tela. Evidências: [decisões](playwright-review-flow-2026-10-06/desktop-chromium-05-screening-after-decisions.png) e [PDF atualizado](playwright-review-flow-2026-10-06/desktop-chromium-08-eligibility-after-upload.png).
5. **Elegibilidade sem surpresa.** “Incluir” fica desabilitado enquanto não houver PDF, e a interface explica como liberar a ação antes de abrir o diálogo. Evidência: [bloqueio sem PDF](playwright-review-flow-2026-10-06/desktop-chromium-07-eligibility-inclusion-blocked-without-pdf.png).
6. **Contadores mais claros.** A fila atual usa “Na fila/Pendentes/Excluídos”; o rodapé diferencia itens nesta fila do total que chegou à etapa; o resumo usa “Encaminhados”, “Excluídos” e “Pendentes”.
7. **Layout.** Em desktops comuns, fila e detalhe ficam lado a lado e o resumo desce para uma área de largura total. As três colunas continuam reservadas para telas realmente largas.
8. **Acessibilidade.** Foram removidos controles interativos aninhados, menus ganharam nomes acessíveis e os rótulos de justificativa foram ligados aos respectivos campos.
9. **Persistência confiável.** Falhas de sincronização do grafo e do índice vetorial são tratadas como efeitos auxiliares: uma decisão já salva no PostgreSQL não volta ao usuário como falsa falha.

## Validação executada

- Playwright: 5 testes aprovados e 1 cenário mobile intencionalmente ignorado (o percurso destrutivo completo roda uma vez em desktop).
- Frontend: 19 testes aprovados no total (3 Node + 16 Vitest).
- Backend: 81 testes aprovados.
- ESLint: aprovado.
- Build Vite de produção: aprovado.

## Decisão de escopo

Revisar ou desfazer decisões já concluídas não foi adicionado, conforme orientação do responsável pelo produto. O fluxo auditado cobre decisões sequenciais de um revisor; concorrência entre revisores, leitor de tela completo e falhas reais de infraestrutura continuam sendo cenários específicos de operação.
