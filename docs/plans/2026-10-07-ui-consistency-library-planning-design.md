# Consistência visual, Biblioteca e Planejamento

Data: 2026-10-07

## Contexto

O Synapse possui dois padrões visuais concorrentes. As páginas gerais usam o `Layout` com menu lateral, `AppHeader` e espaçamento global, enquanto os espaços detalhados de revisão e extração recriam partes do cabeçalho e da navegação. Essa divisão deixa avatar, breadcrumb, largura útil, recuos e densidade visual inconsistentes.

A Biblioteca também se distancia do padrão de Projetos por não ter a mesma hierarquia de título e por envolver toda a listagem em um grande card. No Planejamento, campos com comportamentos semelhantes apresentam affordances diferentes e mudanças locais não deixam claro que ainda precisam ser salvas.

## Objetivos

- Unificar menu, cabeçalho, breadcrumb, avatar e recuos entre páginas gerais e internas.
- Tornar controles interativos reconhecíveis por cursor, hover e foco de teclado.
- Corrigir textos visíveis em português, inclusive acentuação e caracteres corrompidos.
- Remover a navegação redundante de Lixeira.
- Aproximar a Biblioteca do padrão visual e estrutural de Projetos.
- Padronizar o filtro de Projetos com o componente `Select` compartilhado.
- Tornar a edição e o salvamento do Planejamento explícitos e seguros.
- Cobrir os fluxos alterados com testes unitários/de componentes e Playwright.

## Fora de escopo

- Reescrever todo o design system.
- Alterar regras de negócio das etapas PRISMA.
- Remover permanentemente artigos excluídos; eles continuarão disponíveis pelos filtros.
- Introduzir salvamento automático no Planejamento.

## Direção escolhida

Será feita uma refatoração focada no shell compartilhado e nos componentes diretamente relacionados. Ajustes puramente cosméticos manteriam a duplicação atual; uma reformulação completa do design system aumentaria risco e escopo antes da produção.

## 1. Shell e alinhamento das páginas

`AppHeader` será a fonte única para breadcrumb, retorno, ações da página e conta do usuário. O shell terá altura e recuos consistentes:

- 72 px de altura para o cabeçalho em desktop;
- 20 px de recuo horizontal em telas menores e 40 px em desktop;
- alinhamento do breadcrumb e do conteúdo principal pela mesma linha-base;
- avatar e menu da conta presentes também em revisão e extração;
- estados de carregamento e erro preservando o mesmo enquadramento.

As áreas especializadas podem manter painéis e navegação de fluxo próprios, mas devem ficar abaixo ou dentro desse shell, sem duplicar cabeçalho global.

## 2. Affordance e acessibilidade de controles

Elementos acionáveis usarão elementos semânticos (`button`, `a`, controles Radix) e terão:

- `cursor-pointer` quando habilitados;
- cursor de indisponibilidade quando desabilitados;
- hover perceptível;
- foco visível por teclado;
- rótulo acessível em ações apenas com ícone.

Não será aplicado cursor global a containers não interativos.

## 3. Idioma e conteúdo

Os textos visíveis nas superfícies tocadas serão revisados para português brasileiro. Serão corrigidos:

- acentos ausentes, como “Concluído”, “Elegíveis” e “Revisões sistemáticas”;
- caracteres corrompidos por codificação;
- termos em inglês que tenham equivalente já adotado pelo produto;
- capitalização inconsistente em botões, estados e mensagens.

Identificadores técnicos e conteúdo bibliográfico vindo das fontes permanecerão no idioma original.

## 4. Navegação e Biblioteca

O item “Lixeira” será removido do menu, pois aponta para a mesma Biblioteca. O filtro de status continuará oferecendo acesso aos excluídos.

A Biblioteca passará a seguir a hierarquia de Projetos:

- título de página em 30 px com subtítulo;
- filtros e ações em uma barra independente;
- listagem diretamente no canvas, sem o card externo que envolve toda a área;
- linhas/cards internos coerentes com a densidade de Projetos;
- paginação no rodapé da listagem, sem criar uma grande área vazia;
- comportamento responsivo preservado.

## 5. Filtro de Projetos

O `select` nativo de ordenação será substituído pelo `Select` compartilhado usado na Biblioteca. Valores e ordenação atuais serão preservados.

## 6. Planejamento

O Planejamento adotará salvamento manual explícito com proteção contra perda de dados.

### Aparência dos campos

- campos editáveis terão borda, fundo e foco consistentes;
- listas editáveis sempre terão ação de editar visível, não apenas no hover;
- ações de adicionar, editar e remover seguirão o mesmo padrão em todas as seções;
- seções somente informativas serão visualmente distintas de formulários.

### Estado de alterações

O hook de Planejamento manterá uma cópia normalizada do último estado salvo. O estado atual será comparado com essa referência para produzir `isDirty`.

Quando houver mudanças:

- uma barra fixa aparecerá na parte inferior com “Alterações não salvas”;
- “Descartar” restaurará o último estado salvo;
- “Salvar alterações” executará o salvamento existente;
- o botão ficará bloqueado durante a requisição;
- após sucesso, o novo estado passa a ser a referência salva e a barra desaparece;
- em erro, os dados permanecem no formulário e a barra continua visível.

### Saída protegida

Trocar de aba do projeto, navegar por um link interno ou fechar/recarregar o navegador com mudanças pendentes exigirá confirmação. A navegação só prosseguirá depois de confirmar a saída; cancelar manterá o formulário intacto.

## 7. Testes e verificação

### Testes de componentes

- o menu não renderiza “Lixeira”;
- o `Select` compartilhado controla a ordenação de Projetos;
- `AppHeader` mantém breadcrumb e conta do usuário nas variantes;
- o Planejamento identifica mudanças, salva, descarta e preserva dados em erro;
- a troca de aba com mudanças pendentes abre confirmação;
- a Biblioteca renderiza hierarquia, lista e paginação sem container externo redundante.

### Playwright

O fluxo deverá validar em desktop e viewport móvel:

1. abrir Projetos e alterar a ordenação;
2. abrir Biblioteca, filtrar e paginar;
3. abrir um projeto e comparar alinhamento entre visão geral, Planejamento e Artigos;
4. alterar um campo no Planejamento, tentar sair, cancelar, salvar e então navegar;
5. abrir revisão detalhada e extração, confirmando breadcrumb, avatar e espaçamentos;
6. verificar textos, estados de hover/foco e ausência do item Lixeira;
7. capturar evidências visuais da rodada atual.

## Critérios de aceite

- Páginas gerais e internas compartilham o mesmo alinhamento de cabeçalho, breadcrumb e conteúdo.
- Nenhum controle habilitado relevante parece inerte ao mouse ou ao teclado.
- Não há textos visíveis corrompidos ou sem acentuação nas telas alteradas.
- Lixeira não aparece no menu e excluídos continuam acessíveis na Biblioteca.
- Biblioteca segue o padrão de Projetos e não possui o grande card externo.
- Ordenação de Projetos usa o `Select` compartilhado.
- Planejamento comunica claramente o que é editável e quando existem mudanças não salvas.
- Mudanças no Planejamento não são perdidas silenciosamente ao trocar de aba ou sair.
- Testes automatizados e fluxo Playwright passam sem regressões.
