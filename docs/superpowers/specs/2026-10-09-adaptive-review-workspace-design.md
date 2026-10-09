# Workspace adaptativo das etapas de revisão

**Data:** 2026-10-09
**Status:** aprovado para planejamento
**Superfície:** `frontend/src/features/articles/components/ProjectArticles.jsx`

## Objetivo

Reduzir a carga visual da página de etapas sem transformar cada fase da revisão em uma experiência diferente. O usuário deve reconhecer a mesma estrutura ao avançar pelo fluxo PRISMA, enquanto recebe a ferramenta adequada para identificar registros, triar resumos, avaliar textos completos e extrair dados.

O resultado esperado é tornar a próxima ação evidente, acelerar decisões repetitivas e preservar a rastreabilidade humana, especialmente quando há sugestões da IA.

## Princípios aprovados

1. **Um workspace, quatro ferramentas.** A navegação de etapas, a fila, a área principal e o painel contextual mantêm posição e comportamento previsíveis.
2. **A tarefa define o conteúdo.** Cada fase troca apenas a ferramenta central e as ações necessárias para seu objetivo.
3. **IA subordinada à decisão humana.** Sugestões e evidências geradas por IA aparecem como rascunho e nunca confirmam decisões.
4. **Densidade com foco.** Informações secundárias ficam recolhíveis ou contextuais; o artigo e a decisão dominam a hierarquia.
5. **Continuidade responsiva.** Em telas menores, o workspace muda de apresentação, não de modelo mental.

## Estrutura comum

O workspace usa quatro regiões persistentes:

- **Navegador de etapas:** versão compacta do fluxo PRISMA, com etapa ativa, contagens e estados concluídos.
- **Fila à esquerda:** busca, filtros, progresso e lista de registros da etapa atual. Selecionar um item preserva busca, filtro e posição da lista.
- **Área principal:** conteúdo necessário para avaliar o registro selecionado.
- **Painel contextual à direita:** critérios, sugestões, progresso e ação principal da etapa.

O resumo da etapa, as fontes e as ações rápidas deixam de ocupar uma coluna permanente composta por vários cartões. Métricas essenciais entram no cabeçalho da fila ou no painel contextual. Exportação e fluxograma PRISMA ficam como ações secundárias do cabeçalho.

## Adaptação por etapa

### Identificação

- A fila prioriza registros únicos, possíveis duplicatas e grupos já revisados.
- A área principal compara os registros de um possível par ou grupo duplicado.
- O painel contextual oferece as decisões de manter, mesclar ou remover, além do envio dos registros únicos para Triagem.
- Importação, busca e deduplicação continuam disponíveis sem misturar decisões de elegibilidade.

### Triagem

- A fila prioriza estudos pendentes e separa os já decididos.
- A área principal apresenta título, autores, metadados, resumo e critérios relevantes.
- O painel contextual mostra a sugestão da IA, os critérios essenciais e as ações Incluir, Excluir e Pular.
- A decisão é preparada no painel e confirmada com **Salvar e próximo**. Exclusão exige justificativa; inclusão aceita observação opcional.

### Elegibilidade

- A fila preserva o mesmo padrão da Triagem e evidencia disponibilidade do texto completo.
- A área principal exibe o PDF ou, quando indisponível, um estado orientado para envio e resolução do problema.
- O painel contextual fica mais largo e incorpora checklist, evidências, RQs respondidas e decisão final.
- A assistência da IA pode preencher o checklist como rascunho. O usuário revisa e confirma cada decisão.
- Inclusão sem PDF e exclusão sem justificativa continuam bloqueadas pelas regras atuais.

### Inclusão

- A fila mostra estudos incluídos e o estado da extração.
- A área principal resume os campos estruturados e destaca pendências.
- O painel contextual mostra progresso e abre o workspace completo de extração ou a síntese.
- Esta etapa preserva a continuidade visual, mas não recebe controles de decisão de Triagem/Elegibilidade.

## Regras de interação

- Salvar uma decisão bem-sucedida atualiza contagens e abre o próximo registro pendente.
- Uma confirmação não pode disparar duas gravações enquanto estiver em andamento.
- Após uma decisão, uma mensagem temporária oferece desfazer quando a API e as regras de colaboração permitirem reversão segura. Se a reversão não for suportada sem nova regra de negócio, a primeira versão omite essa ação.
- Os atalhos `I`, `E` e `P` ativam Incluir, Excluir e Pular somente quando o foco não está em um campo editável. Todos os atalhos possuem alternativa visível e rótulo acessível.
- Alterações ainda não salvas no checklist ou justificativa exigem confirmação antes de trocar de artigo ou etapa.
- Em modo somente leitura, controles de decisão ficam indisponíveis e explicam a restrição. O conteúdo e o estado colaborativo permanecem visíveis.
- A sugestão da IA deve ser visualmente distinta da decisão humana e identificada como rascunho.

## Fluxo de dados

1. `ProjectArticles` mantém a etapa ativa, filtros, paginação e artigo selecionado por meio do estado e dos hooks existentes.
2. Um novo contêiner de workspace recebe esses dados e escolhe a ferramenta da etapa sem duplicar busca ou regras de negócio.
3. A fila seleciona um artigo e atualiza apenas as áreas principal e contextual.
4. O painel contextual constrói um rascunho local da decisão.
5. A confirmação usa os serviços atuais de Triagem ou Elegibilidade.
6. Em caso de sucesso, o hook atualiza artigo, contagens e próximo pendente. Em caso de falha, o rascunho permanece e o usuário recebe uma mensagem acionável.

Não há mudança de contrato de API prevista. Uma ação de desfazer só entra se puder usar com segurança os endpoints já existentes; caso contrário, fica fora do primeiro incremento.

## Componentes e limites

A implementação deve decompor o atual `ProjectArticles.jsx` sem reescrever regras já testadas:

- `ReviewStageNavigator`: navegação compacta e contagens.
- `AdaptiveReviewWorkspace`: grade responsiva e seleção da ferramenta da etapa.
- `ReviewQueuePanel`: busca, filtros, paginação, progresso e seleção.
- `ArticleReadingPane`: metadados, resumo ou conteúdo de apoio.
- `IdentificationTool`: comparação e resolução de duplicatas.
- `ScreeningDecisionTool`: critérios, IA e decisão de Triagem.
- `EligibilityDecisionTool`: PDF, checklist, evidências, RQs e decisão final.
- `IncludedExtractionTool`: resumo e progresso da extração.

Os componentes recebem dados e callbacks; efeitos, chamadas de serviço e regras de autorização permanecem nos hooks e serviços existentes. A divisão deve permitir testes isolados e evitar um segundo conjunto de regras de revisão.

## Responsividade

- **Desktop amplo:** fila, área principal e painel contextual aparecem simultaneamente.
- **Desktop compacto/tablet:** fila recolhível; área principal e painel contextual permanecem lado a lado quando houver espaço.
- **Mobile:** navegação segmentada entre Fila, Artigo e Decisão. O artigo selecionado e o rascunho sobrevivem à troca de segmento.
- O navegador de etapas pode rolar horizontalmente em telas pequenas, mantendo nome e estado acessíveis.
- A leitura deve manter largura confortável; painéis não podem comprimir texto longo em colunas estreitas.

## Estados e erros

- **Sem seleção:** orientação para escolher o primeiro registro pendente.
- **Fila vazia:** conclusão da etapa e próxima ação apropriada.
- **Sem PDF:** explicação, envio do arquivo e impedimento explícito para inclusão final.
- **IA indisponível:** decisão manual continua utilizável; o painel informa que a sugestão não foi gerada.
- **Falha ao salvar:** preserva checklist, decisão e justificativa; mostra erro próximo à ação e permite tentar novamente.
- **Conflito colaborativo:** atualiza o estado do artigo, impede sobrescrita silenciosa e direciona para a resolução existente.
- **Carregamento:** esqueletos mantêm as dimensões da fila, leitura e painel para evitar saltos de layout.

## Acessibilidade

- Ordem de foco segue navegador, fila, conteúdo e painel de decisão.
- Seleção da fila usa semântica compatível com lista/option e anuncia o artigo ativo.
- Mudanças de salvamento, erro e avanço automático são anunciadas por região de status.
- Cor nunca é o único indicador de decisão, progresso ou conflito.
- Estados de foco, contraste e alvos de toque seguem o design system existente e WCAG AA.
- Atalhos são documentados no próprio painel e nunca capturados durante digitação.

## Estratégia de testes

### Testes de componente

- renderização da ferramenta correta para cada etapa;
- preservação de busca, filtro e seleção;
- justificativa obrigatória em exclusões;
- bloqueio de inclusão sem PDF na Elegibilidade;
- rascunho preservado após erro de serviço;
- modo somente leitura e explicação da restrição;
- atalhos ignorados dentro de campos editáveis;
- navegação responsiva entre Fila, Artigo e Decisão.

### Testes de integração/E2E

- decisão de Triagem, atualização das contagens e avanço ao próximo pendente;
- checklist de Elegibilidade assistido pela IA sem confirmação automática;
- troca de etapa sem perda silenciosa de rascunho;
- resolução de duplicatas em Identificação dentro do mesmo shell;
- abertura do workspace de extração em Inclusão;
- fluxo completo por teclado e estados de erro relevantes.

## Fora do escopo

- mudanças nas APIs ou no modelo de dados;
- redesenho da página de login ou dashboard;
- alteração das regras PRISMA, critérios ou permissões;
- substituição do design system ou criação de nova identidade visual;
- automação de decisões finais pela IA;
- reformulação completa do workspace detalhado de extração.

## Critérios de aceite

1. As quatro etapas compartilham a mesma estrutura visual e de navegação.
2. Cada etapa apresenta apenas ferramentas relevantes para sua tarefa.
3. Triagem e Elegibilidade oferecem decisão focada sem esconder justificativas, critérios ou evidências.
4. Identificação e Inclusão mantêm suas capacidades atuais dentro do novo shell.
5. O fluxo permanece funcional em desktop, tablet e mobile.
6. Nenhuma sugestão da IA é confundida ou aplicada como decisão humana automática.
7. Erros, conflitos e estados somente leitura preservam dados e explicam a próxima ação.
8. Os testes existentes continuam passando e os novos comportamentos possuem cobertura proporcional ao risco.
