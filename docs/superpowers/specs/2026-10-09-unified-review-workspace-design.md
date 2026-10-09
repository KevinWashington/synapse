# Workspace unificado de revisão e extração

**Data:** 2026-10-09  
**Status:** aprovado para planejamento  
**Continua:** `2026-10-09-adaptive-review-workspace-design.md`

## Objetivo

Transformar o workspace adaptativo na superfície principal das quatro etapas da revisão. Triagem, elegibilidade e extração devem acontecer sem navegação obrigatória para uma página interna do artigo. A página detalhada continua disponível como modo de foco e destino de links diretos, mas deixa de ser uma dependência do fluxo operacional.

O refinamento também corrige os problemas observados na implementação atual: estados longos comprimem a fila, a Inclusão mostra um estado sem utilidade, o resumo não aproveita a área central, decisões já enviadas escondem a justificativa e a Elegibilidade apresenta o resumo onde o usuário espera o PDF.

## Evidências da revisão visual

1. **Fila da Elegibilidade:** o selo `Aguardando minha decisão` ocupa a coluna lateral, reduz o espaço do título e provoca rolagem horizontal. A hierarquia do artigo fica subordinada ao estado.
2. **Fila da Inclusão:** `Incluído` apenas repete a etapa atual. O estado útil neste contexto é o progresso da extração.
3. **Leitura central:** o contêiner `max-w-[760px]` ancora o conteúdo à esquerda e deixa uma grande região vazia, principalmente quando o painel de decisão está presente.
4. **Triagem já respondida:** o formulário é corretamente bloqueado, mas não apresenta de forma confiável a decisão individual já enviada. O payload existente em `reviewDecisions` contém a submissão visível do usuário e pode alimentar uma visualização somente leitura.
5. **Elegibilidade:** a ação principal exige leitura do texto completo, mas a superfície central mostra o resumo e delega o PDF à página interna. Essa troca de contexto contradiz o modelo mental da etapa.

## Decisão arquitetural

### Workspace como superfície canônica

O workspace passa a conter toda ação necessária para concluir a etapa atual:

- **Identificação:** metadados, comparação e resolução de duplicatas;
- **Triagem:** resumo, sugestão da IA, decisão e histórico da revisão;
- **Elegibilidade:** PDF embutido, checklist/RQs, decisão e histórico;
- **Inclusão:** formulário de extração, progresso e conclusão.

`ArticleDetails` permanece como visualização complementar. O workspace oferece uma ação secundária `Abrir em modo de foco`, que preserva o artigo e a etapa. Nenhuma tarefa normal exige essa navegação.

### Responsabilidades das regiões

- **Fila:** localizar, filtrar, selecionar e comunicar o próximo trabalho.
- **Painel central:** exibir ou editar o artefato principal da etapa — resumo, PDF ou formulário de extração.
- **Painel contextual:** conter decisão, critérios, progresso e ações relacionadas ao artefato central.

Essas responsabilidades permanecem estáveis entre etapas; muda apenas a ferramenta apresentada.

## Fila e estados

### Nova composição da linha

A linha deixa de ter uma coluna lateral reservada para o selo. A composição será:

1. indicador de estado e origem;
2. título, autores e periódico;
3. linha inferior com estado curto à esquerda e data/menu à direita.

O título mantém prioridade de largura. Estados longos não podem definir a largura mínima da linha nem gerar rolagem horizontal. Explicações completas ficam em `title`/tooltip e em texto acessível no painel contextual.

### Vocabulário curto para colaboração

| Estado de domínio | Rótulo na fila | Explicação completa |
|---|---|---|
| atribuição pendente do usuário | Minha vez | Sua decisão ainda não foi registrada. |
| usuário enviou; faltam pares | Aguardando pares | Sua decisão foi registrada e a revisão aguarda outros revisores. |
| sem atribuição própria; revisão aberta | Em revisão | A revisão está aguardando os revisores atribuídos. |
| conflito aberto | Discordância | A coordenação precisa resolver a divergência. |
| decisão consolidada | Consolidado | A decisão conjunta foi encerrada. |
| redistribuição necessária | Redistribuir | A atribuição requer redistribuição. |

### Estado da Inclusão

Na Inclusão, o selo descreve somente a extração:

- **Não iniciada:** nenhum campo do schema foi preenchido;
- **Em andamento N/M:** existe conteúdo e faltam campos esperados;
- **Concluída:** `extractionCompletedAt` está preenchido.

`M` corresponde aos campos ativos de `project.dataExtractionSchema`. Quando o projeto não possui schema, a interface usa `Em andamento` sem fração e explica a configuração ausente no painel contextual.

Os filtros passam a ser `Todos`, `Não iniciada`, `Em andamento` e `Concluída` quando as contagens estiverem disponíveis. O primeiro incremento pode manter `Todos` e `Pendentes` se a paginação da API ainda não suportar todos os filtros, mas os rótulos das linhas devem ser corretos desde o início.

## Painel central por etapa

### Identificação

Mantém a comparação atual. Metadados compartilhados ocupam a largura disponível e diferenças relevantes permanecem destacadas.

### Triagem

O cabeçalho do artigo ocupa toda a largura do painel. O resumo aparece em um bloco fluido; o texto pode ter limite tipográfico de aproximadamente `72ch`, mas o contêiner, separadores e estados utilizam toda a região central.

Abaixo do resumo, artigos já avaliados exibem `Histórico da decisão`:

- **Sua decisão:** valor, justificativa e data da submissão do registro em `reviewDecisions` cujo `reviewerUserId` corresponde à atribuição atual;
- **Decisão consolidada:** decisão canônica e `screeningReasonText`, quando a revisão estiver consolidada;
- para revisão individual, a decisão canônica é apresentada uma única vez, sem duplicar os dois blocos.

Uma justificativa vazia é representada por `Nenhuma justificativa informada`, nunca por um campo aparentemente perdido.

### Elegibilidade

Com PDF disponível, o painel central renderiza `PdfViewer` por padrão e usa toda a altura útil do workspace. O cabeçalho compacto mantém título e ação `Abrir em modo de foco`.

Sem PDF, o painel apresenta:

- resumo e metadados como contexto;
- estado explícito de texto completo indisponível;
- ação de upload para quem possui permissão;
- explicação de que a inclusão final depende do texto completo.

O histórico segue o mesmo padrão da Triagem, usando a submissão individual em `reviewDecisions` e a decisão canônica em `eligibilityDecision`/`eligibilityReasonText`. Checklist e RQs individuais aparecem apenas quando forem visíveis ao usuário segundo as regras colaborativas existentes.

### Inclusão e extração

`ArticleEvidenceEditor` deixa de ficar escondido na página interna e passa a ser a ferramenta principal do painel central. O editor recebe o mesmo artigo, projeto, permissões e callbacks usados pelo workspace detalhado atual.

O painel contextual mostra:

- quantidade de campos preenchidos e total esperado;
- lista curta de campos pendentes;
- estado somente leitura e sua causa, quando aplicável;
- ação de salvar e, quando as regras permitirem, concluir ou reabrir a extração.

Notas e assistente continuam acessíveis como ferramentas secundárias, sem substituir o formulário principal.

## Largura e responsividade

- Remove-se o limite estrutural `max-w-[760px]` do contêiner central.
- Cabeçalho, PDF, formulário, separadores e mensagens ocupam `width: 100%`.
- Limites de medida são aplicados somente ao conteúdo textual que se beneficia deles, não à região inteira.
- A grade desktop mantém fila, centro e contexto; a fila não pode crescer por causa de um selo.
- Em desktop compacto/tablet, a fila é recolhível e PDF/formulário preservam a maior área.
- Em mobile, os segmentos `Fila`, `Artigo` e `Decisão` continuam. Na Inclusão, `Artigo` é rotulado `Extração`.
- A seleção, página do PDF, rascunho e posição de rolagem sobrevivem à troca de segmento quando tecnicamente viável.

## Modelo de dados e privacidade colaborativa

Não é necessária uma nova API para a primeira versão:

- `reviewDecisions` já entrega a decisão do usuário atual enquanto os demais revisores estão pendentes;
- após a conclusão de todos, as decisões visíveis seguem `visible_decision_payloads`;
- `screeningReasonText` e `eligibilityReasonText` representam a justificativa canônica/consolidada;
- `extractionData`, `dataExtractionSchema` e `extractionCompletedAt` permitem calcular o progresso da extração;
- `hasPdf` e o endpoint já utilizado por `PdfViewer` permitem incorporar o documento.

A interface não deve inferir a decisão individual a partir dos campos canônicos. Ela localiza a submissão individual por `myReviewAssignment.reviewerUserId`. Justificativas de pares permanecem ocultas enquanto a revisão não estiver completa, conforme o contrato atual.

Se algum endpoint paginado omitir `reviewDecisions` ou dados necessários ao PDF/editor, selecionar o artigo deve carregar o detalhe pelo serviço existente e mesclá-lo no estado local. Isso é uma necessidade de consulta, não uma mudança no modelo de domínio.

## Navegação e alterações não salvas

- Trocar artigo, etapa, filtro ou rota com decisão/extração alterada exige confirmação.
- Salvar uma decisão seleciona o próximo registro pendente quando houver.
- Salvar extração mantém o artigo selecionado e atualiza imediatamente o progresso da fila.
- Concluir extração atualiza o estado para `Concluída` sem remover o artigo da visualização atual.
- `Abrir em modo de foco` preserva um retorno explícito ao workspace e não é a ação primária.

## Componentes afetados

- `ReviewQueuePanel`: composição da linha, rótulos colaborativos e progresso de extração;
- `ArticleReadingPane`: contêiner fluido, histórico de decisão, PDF de Elegibilidade e editor de Inclusão;
- `AdaptiveReviewWorkspace`: callbacks/dados do PDF e da extração, além da guarda de alterações;
- `ScreeningDecisionTool` e `EligibilityDecisionTool`: separar formulário editável de histórico somente leitura;
- `ArticleWorkspacePanel`: reutilizar a ferramenta de extração sem manter dois fluxos divergentes;
- `ProjectArticles` e `useProjectArticles`: carregar/mesclar detalhe do artigo quando necessário e atualizar a fila após salvamento.

Componentes existentes (`PdfViewer`, `ArticleEvidenceEditor` e utilitários colaborativos) devem ser reutilizados. A página `ArticleDetails` não será removida neste incremento.

## Acessibilidade

- O estado curto sempre possui descrição completa disponível para tecnologia assistiva.
- A linha selecionada mantém `aria-current` e alvo de toque independente do menu.
- Histórico usa títulos explícitos (`Sua decisão`, `Decisão consolidada`) e não depende apenas de cor.
- O PDF possui nome acessível, fallback e ação equivalente de tela cheia.
- Progresso de extração é anunciado como texto (`3 de 8 campos preenchidos`), não apenas como barra.
- Estados somente leitura explicam por que a ação está indisponível.

## Estratégia de testes

### Componentes

- selo curto não força largura nem rolagem horizontal na fila;
- Inclusão deriva `Não iniciada`, `Em andamento N/M` e `Concluída` corretamente;
- Triagem mostra submissão individual já enviada e decisão consolidada sem vazar decisão de pares;
- Elegibilidade renderiza `PdfViewer` quando `hasPdf` e fallback/upload quando não há PDF;
- painel central não possui limite estrutural estreito;
- Inclusão renderiza `ArticleEvidenceEditor` e respeita modo somente leitura;
- alterações não salvas impedem troca de artigo/etapa até confirmação.

### Integração

- enviar decisão colaborativa, permanecer em modo somente leitura e visualizar a própria justificativa;
- concluir colaboração e visualizar decisão individual e consolidada separadamente;
- selecionar artigo de Elegibilidade e ler o PDF sem mudar de rota;
- preencher, salvar e concluir extração no workspace, atualizando o selo da fila;
- abrir modo de foco e retornar ao mesmo artigo/etapa;
- validar desktop amplo, desktop compacto e mobile sem rolagem horizontal indevida.

## Fora do escopo

- remover a rota de detalhe do artigo;
- alterar regras de consolidação, conflito ou privacidade entre revisores;
- redesenhar o conteúdo interno do `PdfViewer`;
- criar um novo schema de extração;
- automatizar decisões ou concluir extração por IA;
- redesenhar login ou página inicial neste incremento.

## Critérios de aceite

1. Nenhum estado da fila comprime o título ou cria rolagem horizontal.
2. A Inclusão comunica progresso da extração, não apenas que o artigo foi incluído.
3. O conteúdo principal ocupa a largura disponível sem prejudicar a legibilidade do texto.
4. Uma decisão já enviada sempre apresenta a justificativa individual visível ao usuário.
5. Quando consolidada, a decisão final aparece separada da submissão individual.
6. O PDF é a visualização padrão da Elegibilidade quando disponível.
7. A extração pode ser iniciada, salva e concluída dentro do workspace.
8. A página interna é opcional e não é necessária para concluir Triagem, Elegibilidade ou Inclusão.
9. Regras de permissão, privacidade colaborativa e proteção contra perda de rascunho permanecem válidas.
10. Testes automatizados e verificação responsiva cobrem os comportamentos de maior risco.
