# Central do usuário e consentimento para convites

**Data:** 2026-10-09  
**Status:** aprovado para especificação  
**Escopo:** evolução do módulo colaborativo existente do Synapse

## 1. Objetivo

Transformar a central de notificações, hoje limitada ao projeto aberto, em uma caixa de entrada do usuário disponível em toda a área autenticada. Convites deixam de conceder acesso automaticamente: a pessoa convidada deve aceitar ou recusar dentro da plataforma antes de se tornar membro.

Esta entrega também corrige duas falhas observadas no fluxo colaborativo:

- respostas HTTP `204 No Content` não podem ser interpretadas como JSON;
- a distribuição de revisões passa a ser uma funcionalidade principal e deixa de depender da flag de rollout `ASSIGNED_REVIEW_FLOW_ENABLED`.

## 2. Princípios

- Toda comunicação continua dentro da plataforma; não haverá e-mail, SMS ou push.
- Um convite pendente não concede acesso ao projeto.
- Antes do aceite, o convidado vê somente nome do projeto, nome do convidante, papel proposto e se participará da revisão.
- Notificações pertencem ao destinatário, mesmo quando se referem a um projeto.
- `projectId` permanece como contexto para navegação e auditoria, não como limite da caixa de entrada.
- A experiência principal será validada em desktop, com responsividade básica que não impeça uso em telas estreitas.
- Projetos individuais e projetos já compartilhados continuam funcionando.

## 3. Abordagem escolhida

A tabela e o modelo `ProjectNotification` serão preservados. A consulta passa a filtrar por `recipientUserId` em todos os projetos, evitando uma migração e uma segunda infraestrutura de notificações. O nome da tabela permanece histórico; seu comportamento passa a ser de notificação do usuário com contexto de projeto.

Convites continuam em `project_invitations`, mas todos permanecem `pending` até uma decisão explícita. A associação em `project_members` só é criada ou reativada dentro da transação de aceite.

O frontend ganha um estado global de caixa de entrada, independente de `useProjectCollaboration`. Qualquer instância de `AppHeader` mostra o mesmo sino e a mesma contagem.

## 4. Convites e consentimento

### 4.1 Criação

Ao convidar um e-mail:

1. O backend normaliza o endereço com `strip().lower()`.
2. Se já existir um convite pendente para o mesmo projeto e e-mail, ele é atualizado de forma idempotente.
3. Se o e-mail corresponder a uma conta existente, nenhuma associação é criada automaticamente.
4. Se o e-mail ainda não tiver conta, o convite permanece disponível para quando uma conta Google com esse endereço entrar na plataforma.
5. Se a pessoa já for membro ativo, não é criado outro convite; a resposta pública continua neutra e a equipe existente permanece inalterada.
6. O convite expira após sete dias, como no comportamento atual.

O endpoint de criação não revela ao solicitante se o e-mail já possui conta.

### 4.2 Exibição para o convidado

A caixa de entrada localiza convites pendentes pelo e-mail normalizado do usuário autenticado. Cada convite expõe somente:

- identificador do convite;
- nome do projeto;
- nome do convidante, quando disponível;
- papel proposto;
- participação proposta nas revisões;
- data de criação e expiração.

Nenhum artigo, planejamento, membro, estatística ou outro conteúdo do projeto fica acessível antes do aceite.

### 4.3 Aceite

O aceite:

- valida que o e-mail do usuário autenticado corresponde ao convite;
- bloqueia a linha do convite durante a decisão;
- rejeita convites cancelados, expirados ou destinados a outra pessoa;
- cria ou reativa `ProjectMember` com o papel e a participação propostos;
- altera o convite para `accepted` e registra `acceptedAt`;
- registra auditoria;
- cria uma notificação para quem enviou o convite;
- torna o projeto visível na listagem do novo membro imediatamente.

Repetir o aceite depois de concluído é idempotente para o mesmo usuário: não cria membro duplicado e devolve o estado aceito.

### 4.4 Recusa

O modelo aceita o novo status `declined` e o campo `declinedAt`.

A recusa:

- aplica as mesmas validações de identidade e bloqueio do aceite;
- altera o convite para `declined` sem criar associação;
- registra auditoria;
- notifica quem enviou o convite;
- remove o item da caixa de entrada do convidado.

Um novo convite para o mesmo projeto e e-mail poderá ser criado posteriormente, pois a unicidade continua restrita ao status `pending`.

### 4.5 Login Google

O login não chama mais `claim_pending_invitations` e nunca aceita convites implicitamente. Depois da autenticação, a caixa de entrada consulta os convites correspondentes ao e-mail da conta.

## 5. Caixa de entrada do usuário

### 5.1 API

Novos contratos autenticados e independentes de acesso prévio ao projeto:

- `GET /api/inbox?limit={1..100}&beforeId={opcional}`
- `PATCH /api/notifications/{notificationId}/read`
- `POST /api/notifications/read-all`
- `POST /api/invitations/{invitationId}/accept`
- `POST /api/invitations/{invitationId}/decline`

`GET /api/inbox` devolve:

- notificações do usuário, ordenadas da mais recente para a mais antiga;
- convites pendentes válidos para seu e-mail;
- total exato de notificações não lidas;
- total de convites pendentes;
- cursor para notificações anteriores, quando existir.

Cada notificação inclui `projectId` e `projectTitle` quando o projeto ainda existe, além dos campos atuais. A autorização para listar ou marcar uma notificação depende exclusivamente de `recipientUserId`; ela não depende de o usuário ainda ser membro do projeto. Isso permite visualizar avisos como remoção da equipe sem reabrir acesso ao projeto.

Marcar todas como lidas afeta somente notificações. Convites permanecem pendentes até aceitar, recusar, cancelar ou expirar.

As rotas antigas de notificação por projeto serão removidas do frontend e do backend nesta entrega. A caixa de entrada global será o único contrato de notificações da aplicação.

### 5.2 Interface

- O sino fica dentro de `AppHeader`, ao lado do tema e da conta.
- Ele aparece em todas as páginas autenticadas, inclusive no workspace detalhado de artigos.
- O contador soma notificações não lidas e convites pendentes.
- O painel separa `Convites` de `Atualizações`.
- Convites mostram `Aceitar` e `Recusar`, com estado de carregamento que impede duplo envio.
- Após aceitar, a ação principal leva ao projeto.
- Notificações mantêm ações de abrir destino, marcar uma como lida e marcar todas como lidas.
- Quando o usuário não possui mais acesso ao destino, o item continua legível, mas não oferece um link inválido.
- O polling ocorre a cada 30 segundos somente enquanto a sessão está autenticada e a página está visível; abrir o painel força uma atualização.
- A falha da caixa de entrada não bloqueia o restante da aplicação e oferece tentativa manual.

O componente `ProjectNotifications` e o estado de notificações dentro de `useProjectCollaboration` deixam de ser usados.

## 6. Modelo de dados e migração

A nova migração:

- amplia `ck_project_invitations_status` para `pending`, `accepted`, `declined`, `cancelled` e `expired`;
- adiciona `declinedAt TIMESTAMP WITH TIME ZONE NULL`;
- preserva todas as associações, convites, notificações e decisões existentes.

Convites `accepted` existentes permanecem aceitos. Convites `pending` existentes deixam de ser reivindicados automaticamente e passam a exigir decisão do destinatário.

Não haverá alteração destrutiva em `project_notifications`.

## 7. Segurança e concorrência

- Listagem e decisão de convites comparam o e-mail normalizado do convite ao e-mail autenticado.
- Respostas para convites inexistentes ou de outra pessoa são indistinguíveis (`404`).
- Aceite e recusa usam bloqueio transacional para impedir decisões concorrentes.
- Apenas o destinatário marca suas notificações como lidas.
- A caixa de entrada não usa `resolve_project_access`, pois isso impediria convites e avisos após remoção; usa sempre a identidade do destinatário.
- Aceitar um convite cancelado ou expirado não concede acesso.
- Excluir um projeto continua removendo em cascata seus convites e notificações.

## 8. Correções associadas

### 8.1 Respostas sem corpo

`ApiService.request` deve retornar `null` para status `204` antes de examinar ou converter o corpo. Para respostas JSON de sucesso, o cliente lê o texto e retorna `null` quando ele estiver vazio; caso contrário, converte o JSON normalmente.

Isso evita que exclusões concluídas sejam apresentadas como falha e impede listas locais obsoletas que levam a uma segunda operação `404`.

### 8.2 Distribuição de revisões

`ASSIGNED_REVIEW_FLOW_ENABLED` e a validação que devolve `ASSIGNED_REVIEW_DISABLED` serão removidos. Distribuição e prévia ficam disponíveis sempre que o usuário possuir a capacidade `manage_distribution`.

O fluxo individual permanece definido pela existência de atribuições no artigo: sem atribuições ativas, o proprietário continua usando o comportamento individual; distribuir ativa o fluxo colaborativo somente para os artigos distribuídos.

## 9. Tratamento de erros

- `404`: convite ou notificação não pertence ao usuário, não existe ou não está visível.
- `409`: convite já recebeu uma decisão incompatível ou o estado mudou concorrentemente.
- `410`: convite expirado; o frontend o remove da caixa de entrada após atualizar.
- Falhas de rede preservam o item e habilitam nova tentativa.
- Aceite ou recusa bem-sucedidos atualizam caixa de entrada, projetos e sessão de colaboração sem exigir recarregar a página.

## 10. Estratégia de testes

A validação será proporcional e focada em desktop, sem uma nova auditoria móvel completa.

### Backend

- convite para conta existente permanece pendente;
- login não cria associação;
- caixa de entrada só lista itens do usuário;
- aceite cria ou reativa exatamente um membro;
- recusa não cria membro e permite novo convite;
- convite expirado, cancelado ou de outro e-mail não concede acesso;
- aceite e recusa concorrentes produzem uma única decisão final;
- notificações globais podem ser lidas apenas pelo destinatário;
- prévia e distribuição funcionam sem feature flag.

### Frontend

- `ApiService` trata `204` e JSON vazio;
- sino global mostra a soma correta;
- convites exibem dados mínimos e ações explícitas;
- aceite, recusa, erro e duplo clique atualizam estados corretamente;
- notificações navegam para o projeto correto;
- a central aparece nos dois usos de `AppHeader`;
- layout permanece utilizável em largura estreita básica.

### Fluxo desktop

Um fluxo Playwright direcionado cobre: criar convite, entrar como convidado, recusar sem obter acesso, reenviar, aceitar, abrir o projeto e visualizar uma notificação global. Não será repetida a auditoria visual móvel completa.

## 11. Critérios de aceite

- Excluir membro, convite ou projeto com resposta `204` não gera erro no frontend.
- A prévia e a distribuição de revisões deixam de retornar `503` por configuração ausente.
- O sino global aparece em todas as páginas autenticadas.
- A contagem representa todos os projetos e convites pendentes do usuário.
- O convite não cria acesso antes do aceite.
- O convidado pode aceitar ou recusar dentro da plataforma.
- Antes do aceite, nenhum conteúdo interno do projeto é exposto.
- Aceite torna o projeto acessível; recusa mantém o projeto inacessível.
- Quem convidou é avisado da decisão.
- Notificações continuam legíveis mesmo se o acesso ao projeto for removido.
- O fluxo individual e os dados colaborativos existentes permanecem preservados.
