# Estabilidade do fluxo de artigos

## Objetivo

Tornar o fluxo de identificação, triagem, elegibilidade e extração previsível para revisões com centenas ou milhares de artigos. As filas devem representar o trabalho pendente real, as decisões devem ser seguras e as ferramentas exibidas em cada etapa devem corresponder ao que o usuário pode executar.

## Escopo

Esta mudança cobre:

- envio de todos os artigos únicos da identificação para a triagem;
- contagem, filtragem e paginação das filas de triagem e elegibilidade;
- disposição vertical da lista e do rodapé de paginação;
- conteúdo do painel de detalhes do artigo;
- preenchimento opcional da justificativa de triagem com a sugestão da IA;
- ferramentas disponíveis na revisão de triagem e elegibilidade;
- navegação entre PDF, notas e formulário na extração de dados;
- confirmação de ações destrutivas, coletivas ou que encerram uma etapa;
- consistência do header, perfil e breadcrumbs nas páginas internas;
- navegação em um clique entre as abas principais do projeto.

Não serão redesenhados o relatório PRISMA, os critérios científicos, o modelo de decisão ou o formulário configurável de extração.

## Princípios do fluxo

### Fila de trabalho versus histórico

As listas de triagem e elegibilidade são filas de trabalho. Elas devem consultar somente artigos com `reviewOutcome=active` na etapa correspondente. Um artigo decidido deixa imediatamente a fila: artigos incluídos avançam de etapa e artigos excluídos ficam disponíveis no resumo e no relatório, não na lista operacional.

O número `N na fila`, o total usado pela paginação e o texto `X exibidos de N` vêm do `total` retornado pela API para os mesmos filtros da lista. A quantidade histórica que chegou à etapa pode continuar aparecendo como informação secundária, claramente separada do tamanho da fila atual.

Como todos os registros ativos de triagem ou elegibilidade são pendências acionáveis, as abas redundantes `Pendentes` e `Excluídos` serão removidas dessas filas. A identificação mantém seus filtros próprios de únicos e duplicatas; a inclusão mantém o filtro de extração pendente.

### Paginação e altura da lista

O card da fila será uma coluna flexível. O cabeçalho permanece no topo, a região dos artigos ocupa o espaço disponível com rolagem interna e o rodapé de paginação permanece encostado à base do card. A paginação continua server-side, com 20 artigos por página, inclusive durante buscas.

### Detalhe do artigo

O resumo terá um único rótulo visual. A aba/seção `Resumo` permanece, mas o segundo título interno será removido. O texto, a sugestão da IA e as ações de decisão continuam na mesma ordem.

## Envio em massa da identificação

O botão `Enviar todos os únicos para triagem` continua agindo sobre todos os artigos ativos da identificação, não apenas sobre a página visível. A operação deve ser idempotente: repetir a chamada não pode mover registros já processados nem corromper grupos de duplicatas.

O backend continuará detectando duplicatas antes da promoção e retornará quantos artigos foram movidos, quantos registros ficaram pendentes e em quantos grupos. O frontend mostrará esses números e atualizará resumo, duplicatas e lista após a resposta.

Falhas de conexão terão mensagem distinta de erros respondidos pela API. O estado de carregamento sempre será encerrado, e a fila local não será alterada sem confirmação do servidor. A validação deve incluir chamada HTTP real contra um projeto temporário com mais de uma página de artigos. Nenhum teste deve alterar os dados do projeto 7.

## Decisão de triagem e sugestão da IA

Quando `article.aiEvaluation` possuir texto, o diálogo de decisão exibirá a ação secundária `Usar justificativa da IA`. Essa ação apenas copia o texto para o campo de justificativa. Ela não muda a decisão selecionada, não fecha o diálogo e não envia a decisão.

O usuário pode editar ou apagar o texto copiado antes de salvar. A justificativa permanece obrigatória somente para exclusão, conforme a regra atual.

## Ferramentas por etapa

As ferramentas deixam de ser uma lista universal e passam a depender do fluxo:

- Triagem: `Notas` e `Assistente IA`.
- Elegibilidade: `Notas` e `Assistente IA`.
- Extração: formulário de extração à direita; `PDF` e `Notas` à esquerda.

A aba `Extração` não aparece durante triagem ou elegibilidade. O botão independente `Assistente IA` no cabeçalho do artigo será removido porque duplica a aba do painel lateral.

Caso uma URL solicite um workspace inválido para a etapa, a tela selecionará a primeira aba permitida, sem renderizar conteúdo inacessível ou quebrar a navegação.

## Workspace de extração

A extração permanece em uma única tela. O botão `Ver detalhes do artigo` será removido. No painel esquerdo, as abas `PDF` e `Notas` alternam localmente entre o visualizador e o editor de notas, sem navegar para outro workspace.

Trocar para Notas e voltar para PDF não desmonta o formulário de extração nem perde os valores ainda não enviados. Salvar notas usa a operação existente e não interfere no rascunho da extração. A troca entre artigos mantém `flow=included&workspace=extracao` e abre o artigo seguinte no mesmo contexto.

### Conclusão da extração

`Salvar rascunho` continua salvando imediatamente. `Marcar como concluído` abre um modal antes de enviar os dados, informando que o estudo será contabilizado como extraído. Cancelar mantém o formulário aberto e não chama a API; confirmar envia o conteúdo atual com `markExtractionComplete=true`.

Será criado um diálogo de confirmação reutilizável e acessível para ações destrutivas, coletivas ou que encerram uma etapa. Nesta rodada ele será aplicado a `Marcar como concluído`, remoção de artigo ou projeto, envio de todos os únicos e confirmação coletiva da revisão de duplicatas. Decisões de triagem e elegibilidade já possuem diálogo próprio e não receberão uma segunda confirmação. Salvamentos comuns, navegação e seleção não exigem modal.

## Header e breadcrumbs

As páginas internas usarão a linguagem visual atualmente presente nos workspaces detalhados: header de 72 pixels e breadcrumb textual com chevrons, primeiro item clicável em roxo e níveis seguintes em cor secundária. O componente será compartilhado, evitando uma versão no layout e outra codificada dentro da tela de artigo.

Nos projetos, o breadcrumb será `Projetos > nome do projeto > seção atual`. Nas telas de artigo, será `Projetos > nome do projeto > Triagem`, `Elegibilidade` ou `Extração de dados`. Dashboard e listas de primeiro nível não inventarão um breadcrumb sem nível pai.

Os controles de tema e conta permanecerão à direita em toda página autenticada, inclusive screening, elegibilidade e extração. O avatar, nome, e-mail e ação de sair sempre virão do usuário autenticado; o círculo fixo com as letras `JS` será removido. O workspace pode continuar sem o menu lateral para preservar a área de leitura, mas não terá um header visualmente incompatível.

## Navegação entre abas do projeto

A URL será a fonte única de verdade para a aba principal (`tab`) e para a etapa de artigos (`flow`). Não haverá estado local espelhando `tab` e depois tentando reconciliá-lo por efeito.

Cada clique produzirá uma única atualização de URL:

- `tab=artigos` preserva um `flow` válido ou usa `identification` como padrão;
- sair de Artigos remove `flow` e parâmetros exclusivos dessa área;
- mudar apenas a etapa de artigos preserva `tab=artigos`;
- abrir Visão Geral remove `tab` por ser o valor padrão;
- parâmetros não relacionados e válidos não serão sobrescritos por um efeito de um componente que está sendo desmontado.

Assim, qualquer transição entre Visão Geral, Planejamento, Artigos, Fluxo, Síntese e Gráficos deve acontecer com um único clique, sem piscar ou retornar temporariamente à aba anterior.

## Organização do frontend

`useProjectArticles` será a fonte dos filtros enviados ao servidor e dos totais da fila. `ProjectArticles` apenas renderizará os números recebidos e não calculará totais globais a partir dos artigos da página atual.

`ArticleWorkspacePanel` receberá a etapa ativa e derivará as abas permitidas. O workspace dedicado de extração terá estado local para `PDF`/`Notas`; ele não reutilizará uma rota de revisão para simular detalhes.

Um componente compartilhado de header receberá uma lista de itens de breadcrumb e reutilizará os controles reais de conta. Um componente compartilhado de confirmação receberá título, descrição, rótulos das ações, tom e callback de confirmação. Ambos permanecerão sem dependências novas.

O código seguirá os componentes e serviços existentes. Não será criada uma nova camada global de estado nem adicionada dependência de interface.

## Tratamento de erros

- A API indisponível durante promoção em massa produz mensagem clara para verificar a conexão e tentar novamente.
- Respostas HTTP com erro preservam a mensagem útil retornada pelo backend.
- Uma página que fique vazia após uma decisão recua para a última página válida ou atualiza a fila para o primeiro resultado disponível.
- A ausência de sugestão da IA simplesmente oculta a ação de cópia.
- A ausência de PDF mantém o comportamento atual da etapa, sem expor extração antecipadamente.
- Cancelar um modal de confirmação nunca executa a ação nem descarta dados digitados.
- Uma URL com `tab` ou `flow` inválido volta diretamente ao padrão correspondente, sem ciclo de atualizações.

## Testes e critérios de aceite

### Testes automatizados

- hook de artigos envia `phase=screening|eligibility`, `outcome=active`, `page` e `limit=20`;
- contadores e paginação usam o total do servidor, não `articles.length`;
- artigos excluídos não aparecem nas filas de triagem e elegibilidade;
- rodapé permanece na base do card em viewport maior que o conteúdo;
- resumo é rotulado uma única vez;
- copiar justificativa da IA apenas preenche o campo e o envio só ocorre ao confirmar;
- triagem e elegibilidade não exibem a aba de extração;
- elegibilidade não exibe o botão redundante de Assistente IA;
- extração alterna PDF/Notas e preserva o formulário montado;
- promoção em massa move mais de uma página de únicos, preserva duplicatas e é idempotente;
- concluir extração exige confirmação e cancelar não chama `onSave`;
- ações destrutivas ou coletivas incluídas no escopo usam o diálogo compartilhado, não `window.confirm`;
- workspaces detalhados exibem o avatar e o menu do usuário autenticado;
- breadcrumbs de projeto e artigo usam a mesma estrutura e o mesmo estilo;
- cada aba principal abre no primeiro clique, inclusive Visão Geral → Planejamento, Planejamento → Artigos e Fluxo → Artigos;
- `tab` e `flow` permanecem consistentes ao usar voltar/avançar do navegador.

### Playwright

O fluxo será exercitado com dados temporários:

1. abrir identificação com mais de 20 artigos e promover todos os únicos;
2. confirmar que o total completo avançou e que as duplicatas permaneceram;
3. decidir inclusão e exclusão em triagem e confirmar que ambos deixam a fila;
4. usar a sugestão da IA como justificativa, editar e salvar;
5. repetir a verificação da fila na elegibilidade;
6. abrir um incluído na extração, alternar PDF/Notas, salvar nota e continuar preenchendo a extração;
7. navegar entre artigos incluídos e confirmar que o workspace continua funcional;
8. cancelar e confirmar a conclusão de uma extração, verificando que somente a confirmação chama a API;
9. percorrer todas as abas principais com um clique e testar voltar/avançar do navegador;
10. confirmar que screening, elegibilidade e extração mantêm breadcrumb, tema e conta do usuário no header.

O teste não reutilizará nem modificará o projeto 7. Dados temporários serão removidos pelos mecanismos já usados na suíte ou ficarão isolados no banco de teste.

## Resultado esperado

Em qualquer etapa, o usuário vê exatamente a quantidade de artigos que ainda exigem ação, pode percorrer a fila sem listas excessivamente longas e encontra apenas ferramentas válidas para aquele momento do processo. Decisões retiram imediatamente o artigo da fila, e a extração não perde contexto ao consultar PDF ou notas.
