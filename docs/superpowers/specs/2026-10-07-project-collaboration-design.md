# Colaboração em projetos, distribuição de revisões e notificações internas

**Data:** 2026-10-07  
**Status:** aprovado  
**Escopo:** colaboração dentro de projetos existentes do Synapse

## 1. Objetivo

Permitir que um projeto seja usado por uma pessoa ou por uma equipe de qualquer tamanho, sem quebrar o fluxo individual existente. Membros convidados poderão consultar todo o projeto, trabalhar em filas atribuídas e produzir decisões independentes. O sistema consolidará concordâncias, encaminhará divergências para desempate e manterá toda a comunicação dentro da plataforma.

## 2. Princípios do produto

- Um projeto funciona com uma única pessoa e continua funcionando conforme a equipe cresce.
- Todos os membros ativos podem consultar todos os artigos do projeto.
- Permissões de escrita dependem do papel e, para revisores, da atribuição do artigo.
- Quando houver pelo menos duas pessoas aptas a revisar, cada artigo recebe duas pessoas diferentes por padrão.
- Decisões paralelas são cegas até todas as pessoas atribuídas concluírem.
- A concordância é consolidada automaticamente; qualquer divergência exige desempate humano.
- Nenhuma notificação ou convite é enviado para fora da plataforma.
- Operações em lote geram notificações resumidas, não uma notificação por artigo.
- A trilha histórica não é apagada quando alguém sai da equipe ou uma atribuição muda.

## 3. Papéis e capacidades

### 3.1 Proprietário

O proprietário é definido por `Project.ownerId` e possui controle total:

- editar planejamento e configurações;
- convidar, remover e alterar membros;
- configurar e executar distribuições;
- participar das revisões;
- redistribuir itens pendentes;
- resolver discordâncias e reabrir decisões;
- excluir o projeto;
- transferir a propriedade.

Ao transferir a propriedade, o antigo proprietário se torna coordenador e participa das revisões por padrão.

### 3.2 Coordenador

O coordenador pode:

- editar planejamento e configurações;
- convidar, remover e alterar membros;
- configurar, executar e corrigir distribuições;
- resolver discordâncias e reabrir decisões;
- participar das revisões quando a opção `participatesInReview` estiver habilitada.

O coordenador não pode excluir o projeto nem transferir a propriedade.

### 3.3 Revisor

O revisor pode consultar todo o projeto, mas sua escrita fica restrita aos artigos atribuídos:

- registrar decisões e justificativas;
- preencher checklist de elegibilidade;
- registrar RQs respondidas;
- editar notas e extração dos artigos atribuídos.

O revisor não altera planejamento, equipe, distribuição, configurações ou decisões de outros membros. Revisores sempre participam da distribuição enquanto estiverem ativos.

## 4. Modelo de acesso

O backend passará a resolver acesso por projeto em um único serviço ou dependência. A resolução devolve o papel e as capacidades efetivas do usuário.

1. Se `Project.ownerId == current_user.id`, o acesso é de proprietário.
2. Caso contrário, deve existir uma associação ativa em `project_members`.
3. Sem uma das condições acima, a API responde como projeto inexistente para evitar enumeração de dados.

Depois de autorizado o acesso ao projeto, artigos são consultados por `projectId`. O `Article.ownerId` permanece como autoria ou compatibilidade histórica, mas deixa de ser um filtro de autorização para membros do projeto.

As listagens de projetos devem unir projetos próprios e projetos compartilhados, retornando o papel e as capacidades efetivas do usuário em cada item.

## 5. Modelo de dados

### 5.1 `project_members`

- `id`
- `projectId`
- `userId`
- `role`: `coordinator` ou `reviewer`
- `status`: `active` ou `inactive`
- `participatesInReview`
- `invitedByUserId`
- `joinedAt`, `deactivatedAt`, `createdAt`, `updatedAt`

Restrições:

- associação única por `(projectId, userId)`;
- revisores ativos sempre possuem `participatesInReview = true`;
- o proprietário não precisa de uma linha nessa tabela.

### 5.2 `project_invitations`

- `id`
- `projectId`
- `emailNormalized`
- `role`: `coordinator` ou `reviewer`
- `participatesInReview`
- `status`: `pending`, `accepted`, `cancelled` ou `expired`
- `invitedByUserId`
- `expiresAt`, `acceptedAt`, `createdAt`, `updatedAt`

Convites pendentes expiram após sete dias. Deve existir no máximo um convite pendente por `(projectId, emailNormalized)`.

### 5.3 `review_assignments`

- `id`
- `projectId`
- `articleId`
- `phase`: `screening` ou `eligibility`
- `reviewerUserId`
- `slot`: 1 ou 2
- `status`: `pending`, `submitted`, `cancelled` ou `needs_reassignment`
- `assignedByUserId`
- `inheritedFromAssignmentId`, quando a elegibilidade herdar a dupla da triagem
- `assignedAt`, `submittedAt`, `cancelledAt`, `createdAt`, `updatedAt`

Restrições:

- atribuição única por `(articleId, phase, reviewerUserId)`;
- posição única por `(articleId, phase, slot)` entre atribuições ativas;
- a mesma pessoa nunca ocupa os dois slots do mesmo artigo.

### 5.4 `review_decisions`

- `id`
- `assignmentId`
- `projectId`, `articleId`, `phase`, `reviewerUserId`
- `decision`
- `reasonText`
- `checklistAnswers`
- `answeringRQs`
- `status`: `draft`, `submitted` ou `superseded`
- `submittedAt`, `createdAt`, `updatedAt`

Cada atribuição possui no máximo uma decisão submetida vigente. Decisões substituídas permanecem na auditoria.

### 5.5 `review_conflicts`

- `id`
- `projectId`, `articleId`, `phase`
- `status`: `open` ou `resolved`
- `decisionIds`
- `resolvedDecision`
- `resolutionReason`
- `resolvedByUserId`
- `createdAt`, `resolvedAt`, `updatedAt`

Existe no máximo um conflito aberto por `(articleId, phase)`.

### 5.6 `project_notifications`

- `id`
- `projectId`
- `recipientUserId`
- `type`
- `title`
- `body`
- `entityType`, `entityId`
- `payload`
- `readAt`, `createdAt`

O `payload` contém apenas dados necessários para navegação e apresentação; não duplica o estado completo de artigos ou projetos.

## 6. Convites internos

1. Proprietário ou coordenador informa e-mail, papel e participação nas revisões.
2. O backend normaliza o endereço com `strip().lower()`.
3. Se o usuário já existir, a associação é criada e uma notificação interna é gerada.
4. Se ainda não existir, o convite permanece pendente.
5. Após autenticação Google, o sistema procura convites pendentes pelo e-mail normalizado e cria as associações automaticamente.
6. O novo membro recebe uma notificação interna informando o projeto e o papel.
7. O responsável pelo convite recebe uma notificação resumida de aceite.

Não haverá e-mail, link externo ou token enviado ao convidado. A API não deve revelar para o solicitante se o e-mail já possui conta fora do contexto do convite.

## 7. Distribuição automática controlada

A distribuição nunca acontece silenciosamente. Proprietário ou coordenador inicia a ação na aba Equipe.

### 7.1 Participantes elegíveis

- proprietário;
- coordenadores ativos com `participatesInReview = true`;
- revisores ativos.

### 7.2 Quantidade por artigo

- Com apenas uma pessoa elegível no projeto, cada artigo recebe uma atribuição e uma decisão consolida imediatamente.
- Com duas ou mais pessoas elegíveis, cada artigo recebe exatamente duas pessoas diferentes.
- O tamanho total da equipe pode variar de uma a qualquer quantidade de membros; não há mais de duas atribuições automáticas por artigo nesta versão.

### 7.3 Algoritmo

1. Selecionar apenas artigos da etapa ainda sem atribuições ativas.
2. Calcular a carga pendente de cada participante na etapa.
3. Para cada artigo, escolher as duas menores cargas possíveis, usando ordem estável por identificador como desempate.
4. Incrementar a carga em memória após cada escolha.
5. Persistir todas as atribuições em uma transação.

O resultado deve manter diferença máxima de um item sempre que a combinação de artigos e participantes permitir. Reexecutar a operação afeta apenas artigos ainda não atribuídos.

### 7.4 Elegibilidade

Artigos aprovados na triagem herdam a mesma dupla na elegibilidade. Se alguém estiver inativo, a atribuição correspondente recebe `needs_reassignment` e aparece para o coordenador. A substituição é manual e auditada.

## 8. Decisões cegas e consolidação

- Cada revisor acessa somente sua própria decisão enquanto o conjunto está incompleto.
- A interface pode mostrar quem está atribuído e o estado de conclusão, mas não o conteúdo da decisão alheia.
- Uma decisão submetida fica bloqueada até consolidação, conflito ou reabertura administrativa.

Consolidação:

- Uma atribuição: a decisão atualiza imediatamente os campos canônicos de `Article`.
- Duas atribuições com a mesma decisão: o resultado é consolidado automaticamente.
- Duas decisões diferentes: o artigo permanece na etapa e um `review_conflict` é aberto.

No desempate, proprietário ou coordenador visualiza as duas decisões, escolhe o resultado final e fornece justificativa obrigatória. A resolução atualiza o artigo e notifica os revisores.

Os campos atuais de `Article` continuam sendo o resultado canônico consumido por PRISMA, gráficos, síntese e exportações. Somente o serviço de consolidação pode atualizá-los em modo atribuído.

Reabrir uma decisão:

- exige proprietário ou coordenador;
- exige uma justificativa;
- marca decisões vigentes como substituídas;
- reabre as atribuições necessárias;
- registra auditoria e gera notificação resumida.

## 9. Compatibilidade com o fluxo atual

- Projetos e artigos existentes começam sem atribuições.
- Sem atribuições ativas, o proprietário continua usando as rotas e o comportamento individual existentes.
- A primeira distribuição ativa o fluxo independente apenas nos artigos distribuídos.
- Um projeto individual continua operacional indefinidamente.
- Adicionar membros não altera artigos automaticamente; é necessário executar a distribuição.
- Remover membros não apaga decisões. Atribuições pendentes ficam aguardando redistribuição.

As rotas atuais de triagem e elegibilidade permanecem como contrato da interface. Internamente, o serviço decide entre consolidação individual e registro de decisão atribuída. A resposta passa a incluir um estado: `waiting_for_reviewer`, `consolidated` ou `conflict`.

## 10. API proposta

### Equipe e convites

- `GET /api/projetos/{projectId}/members`
- `POST /api/projetos/{projectId}/invitations`
- `PATCH /api/projetos/{projectId}/invitations/{invitationId}`
- `DELETE /api/projetos/{projectId}/invitations/{invitationId}`
- `PATCH /api/projetos/{projectId}/members/{memberId}`
- `DELETE /api/projetos/{projectId}/members/{memberId}`
- `POST /api/projetos/{projectId}/transfer-ownership`

### Distribuição

- `POST /api/projetos/{projectId}/assignments/preview`
- `POST /api/projetos/{projectId}/assignments/distribute`
- `PATCH /api/projetos/{projectId}/assignments/{assignmentId}`
- `GET /api/projetos/{projectId}/assignments/me`

### Discordâncias

- `GET /api/projetos/{projectId}/conflicts`
- `POST /api/projetos/{projectId}/conflicts/{conflictId}/resolve`
- `POST /api/projetos/{projectId}/artigos/{articleId}/reopen-review`

### Notificações

- `GET /api/projetos/{projectId}/notifications`
- `PATCH /api/projetos/{projectId}/notifications/{notificationId}/read`
- `POST /api/projetos/{projectId}/notifications/read-all`

## 11. Interface

### 11.1 Aba Equipe

A navegação do projeto ganha a aba `Equipe`, disponível para todos. Revisores veem membros e carga, mas controles administrativos respeitam suas permissões.

Seções:

- resumo de membros ativos, convites pendentes, itens não atribuídos e discordâncias;
- lista de membros com papel, participação, carga e estado;
- convites pendentes, expirados e cancelados;
- distribuição com participantes, prévia de carga e confirmação;
- fila de discordâncias e resolução.

### 11.2 Artigos

- filtro `Atribuídos a mim`;
- indicadores de revisores e progresso sem revelar decisões ocultas;
- estados `Aguardando minha decisão`, `Aguardando outro revisor`, `Em discordância` e `Consolidado`;
- ações de decisão desabilitadas, com explicação, para quem não possui atribuição;
- acesso de leitura preservado para todos os membros.

### 11.3 Central de notificações

- sino no cabeçalho do projeto;
- contador de itens não lidos;
- painel do projeto atual;
- ação de marcar item ou todos como lidos;
- navegação para artigo, convite, distribuição ou discordância;
- polling leve somente enquanto um projeto estiver aberto.

Uma distribuição em lote gera uma única notificação por destinatário com a quantidade e a etapa.

## 12. Eventos que geram notificações

- convite associado ou aceito;
- entrada, remoção ou alteração de papel de membro;
- lote de artigos atribuído ou redistribuído;
- atribuição marcada para redistribuição;
- discordância aberta;
- discordância resolvida;
- revisão reaberta.

Eventos rotineiros de leitura, edição de rascunho e cada decisão individual não geram notificações extras.

## 13. Integridade, concorrência e auditoria

- Distribuição, submissão, consolidação e resolução usam transações.
- A consolidação bloqueia a linha do artigo para impedir resultados concorrentes.
- Restrições únicas impedem membros, convites, slots, atribuições ou decisões duplicadas.
- Toda escrita valida acesso ao projeto e, quando aplicável, a atribuição do artigo.
- Operações administrativas registram ator, data, entidade e motivo.
- Histórico concluído não é apagado em remoções ou redistribuições.
- Exclusão do projeto remove os dados colaborativos em cascata junto com o projeto.

## 14. Migração e implantação

1. Criar novas tabelas, restrições e índices.
2. Introduzir o resolvedor central de acesso ao projeto.
3. Migrar consultas de artigos para autorização por projeto em vez de `Article.ownerId`.
4. Manter proprietário implícito por `Project.ownerId`, sem backfill obrigatório.
5. Liberar equipe e convites antes da distribuição.
6. Liberar distribuição e decisões independentes atrás de uma configuração de aplicação durante a validação.
7. Incluir novas tabelas nos dumps e procedimentos de restauração de produção.

## 15. Estratégia de testes

### Backend unitário

- resolução de papéis e capacidades;
- normalização e reivindicação de convites;
- balanceamento com uma, duas e muitas pessoas no projeto;
- estabilidade e idempotência da distribuição;
- consolidação individual, concordância e discordância;
- reabertura e redistribuição.

### Integração

- isolamento entre projetos e membros;
- bloqueio de escrita para revisores sem atribuição;
- acesso de leitura a artigos não atribuídos;
- concorrência em submissão e consolidação;
- preservação histórica após remoção de membro;
- transição de convite pendente no login Google.

### Frontend

- controles por papel;
- estados de atribuição e revisão cega;
- central de notificações e marcação de leitura;
- prévia e confirmação da distribuição;
- resolução de discordância.

### Playwright

- projeto individual sem regressão;
- convite interno e entrada de membro;
- distribuição equilibrada;
- duas decisões iguais e consolidação;
- duas decisões diferentes e desempate;
- revisor consultando todos os artigos, mas decidindo apenas os atribuídos;
- notificações resumidas e navegação para o item correto.

## 16. Fora do escopo desta versão

- envio de e-mail, SMS ou push;
- WebSocket ou infraestrutura de eventos externa;
- comentários em tempo real;
- mais de duas atribuições automáticas por artigo;
- equipes ou organizações compartilhadas entre projetos;
- cobrança por assento;
- menções, chat ou edição simultânea de planejamento;
- delegação automática baseada em especialidade.

## 17. Critérios de aceite

- Projetos continuam operando com uma única pessoa.
- Projetos compartilhados aparecem para membros autorizados.
- Todos os membros podem consultar todos os artigos.
- Revisores só alteram artigos atribuídos.
- Distribuição controlada cria uma ou duas atribuições conforme a quantidade de participantes aptos.
- A dupla da triagem é preservada na elegibilidade.
- Decisões permanecem cegas até a conclusão do conjunto.
- Concordâncias consolidam; divergências bloqueiam e criam desempate.
- Notificações ficam integralmente dentro da plataforma.
- Projetos e fluxos existentes continuam cobertos por testes de regressão.
