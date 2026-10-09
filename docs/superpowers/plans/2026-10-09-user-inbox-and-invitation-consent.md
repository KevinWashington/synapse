# Central do usuário e consentimento para convites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar uma caixa de entrada global por usuário, convites com aceite ou recusa explícitos, distribuição de revisões sempre disponível e tratamento correto de respostas HTTP sem corpo.

**Architecture:** Preservar `ProjectNotification` e seus vínculos com projeto, mas consultá-la por destinatário em um router global `/api`. Convites pendentes continuam em `ProjectInvitation` até uma decisão transacional do e-mail convidado; o frontend usa um provider global de caixa de entrada consumido por todas as instâncias de `AppHeader`.

**Tech Stack:** FastAPI, SQLAlchemy async, Alembic, PostgreSQL, React, React Router, Vitest, pytest e Playwright desktop.

**Spec:** `docs/superpowers/specs/2026-10-09-user-inbox-and-invitation-consent-design.md`

## Global Constraints

- Nenhum convite concede acesso antes de ser aceito pela conta cujo e-mail normalizado corresponde ao convite.
- A caixa de entrada não exige acesso ao projeto para listar ou marcar uma notificação do próprio destinatário.
- Convites só expõem nome do projeto, convidante, papel, participação em revisão e datas.
- Retirar `ASSIGNED_REVIEW_FLOW_ENABLED`; a capacidade do usuário é o único gate da distribuição.
- Tratar `204` e JSON de corpo vazio como sucesso com retorno `null` no cliente HTTP.
- Usar TDD: todo comportamento novo ou corrigido começa com teste que falha.
- Validar a interface em desktop e manter layout estreito utilizável, sem nova auditoria visual móvel completa.

## Review Focus

- Um convite destinado a outro e-mail nunca pode ser lido, aceito ou recusado pela conta atual; cobrir no Task 2.
- Aceite e recusa concorrentes devem produzir uma única decisão e, no máximo, uma associação ativa; cobrir no Task 2.
- Uma notificação sobre remoção deve continuar legível, sem abrir uma rota de projeto à qual o usuário perdeu acesso; cobrir no Task 3 e Task 5.
- Uma resposta `204` com `Content-Type: application/json` não pode chamar `response.json()`; cobrir no Task 1.
- A contagem do sino deve incluir convites pendentes sem contar duas vezes notificações comuns; cobrir no Task 5.

---

### Task 1: Cliente HTTP resiliente a respostas vazias

**Files:**
- Modify: `frontend/src/services/api.js:92-110`
- Create: `frontend/src/services/api.test.js`

**Interfaces:**
- Produces: `ApiService.request(endpoint, options)` retorna `null` para `204` e para JSON sem corpo; continua retornando binários e JSON preenchido como hoje.
- Consumes: `fetch` e `ApiError` existentes.

- [ ] **Step 1: Write the failing test**

```js
it("returns null for a 204 response that advertises application/json", async () => {
  global.fetch = vi.fn().mockResolvedValue(new Response(null, {
    status: 204,
    headers: { "content-type": "application/json" },
  }));

  await expect(apiService.delete("/api/projetos/1")).resolves.toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/api.test.js`  
Expected: FAIL with `Unexpected end of JSON input`.

- [ ] **Step 3: Implement empty-body handling in `ApiService.request`**

Return `null` before parsing when `response.status === 204`. For JSON responses with another status, read text once and return `null` when it is empty; otherwise parse it as JSON. Preserve current binary response behavior.

- [ ] **Step 4: Run the targeted test to verify it passes**

Run: `npx vitest run src/services/api.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/api.js frontend/src/services/api.test.js
git commit -m "fix: handle empty API responses"
```

### Task 2: Convites pendentes com decisão explícita

**Files:**
- Modify: `backend/app/models/collaboration.py:35-63`
- Modify: `backend/app/schemas/collaboration.py:11-51`
- Modify: `backend/app/services/invitation_service.py`
- Modify: `backend/app/routers/auth.py:18,80-92`
- Modify: `backend/app/routers/collaboration.py:105-239`
- Create: `backend/migrations/versions/0004_user_inbox_invitation_consent.py`
- Modify: `backend/tests/test_project_invitations.py`
- Modify: `backend/tests/test_google_auth.py`

**Interfaces:**
- Produces: `GET /api/invitations`, `POST /api/invitations/{invitationId}/accept`, and `POST /api/invitations/{invitationId}/decline`.
- Produces: `ProjectInvitation.status` includes `declined`; `declinedAt` is nullable and populated only by recusa.
- Consumes: `normalize_email`, `_activate_member`, audit and notification services.

- [ ] **Step 1: Write failing backend tests for invitation visibility and decisions**

```python
async def test_existing_user_invitation_stays_pending_until_accept(client, owner, invitee):
    invitation = await invite(client, owner, invitee.email)
    assert await project_is_hidden(client, invitee, invitation.project_id)
    accepted = await accept(client, invitee, invitation.id)
    assert accepted.status_code == 200
    assert await project_is_visible(client, invitee, invitation.project_id)

async def test_invitee_can_decline_without_becoming_member(client, owner, invitee):
    invitation = await invite(client, owner, invitee.email)
    response = await decline(client, invitee, invitation.id)
    assert response.status_code == 200
    assert await active_membership(invitation.project_id, invitee.id) is None
```

Add cases for another e-mail (`404`), expired/cancelled invitation, duplicate acceptance, decline then re-invite, and concurrent accept/decline.

- [ ] **Step 2: Run targeted tests to verify they fail**

Run: `pytest backend/tests/test_project_invitations.py backend/tests/test_google_auth.py -q`  
Expected: FAIL because existing accounts are added immediately, login claims invitations, and decision routes do not exist.

- [ ] **Step 3: Add migration, model and schemas**

Create Alembic revision `0004_user_inbox_invitation_consent` to replace the invitation status check and add `declinedAt`. Add response schemas that expose only the invitation-safe fields plus project and inviter display names.

- [ ] **Step 4: Replace automatic claiming with explicit invitation decisions**

Make invitation creation always create/update a pending invitation unless an active membership already exists. Remove `claim_pending_invitations` from Google authentication. Implement list, accept and decline operations under row locking; accept calls `_activate_member`, records audit and notifies the inviter, while decline records audit and notifies the inviter without membership creation.

- [ ] **Step 5: Run targeted tests to verify they pass**

Run: `pytest backend/tests/test_project_invitations.py backend/tests/test_google_auth.py -q`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app backend/migrations/versions/0004_user_inbox_invitation_consent.py backend/tests/test_project_invitations.py backend/tests/test_google_auth.py
git commit -m "feat: require consent for project invitations"
```

### Task 3: API e serviço da caixa de entrada global

**Files:**
- Modify: `backend/app/services/notification_service.py`
- Modify: `backend/app/schemas/collaboration.py`
- Create: `backend/app/routers/inbox.py`
- Modify: `backend/app/main.py:9,88-94`
- Modify: `backend/app/routers/collaboration.py:369-403`
- Modify: `backend/tests/test_notification_service.py`
- Modify: `backend/tests/test_collaboration_routes.py`
- Create: `backend/tests/test_user_inbox.py`

**Interfaces:**
- Produces: `GET /api/inbox?limit&beforeId` returning `{ notifications, invitations, unreadNotificationCount, pendingInvitationCount, nextNotificationCursor }`.
- Produces: `PATCH /api/notifications/{notificationId}/read` and `POST /api/notifications/read-all` for the authenticated recipient.
- Consumes: notification rows, pending invitation listing and user identity.

- [ ] **Step 1: Write failing tests for cross-project inbox behavior**

```python
async def test_inbox_aggregates_only_current_users_notifications_and_pending_invites(client, user):
    payload = await get_inbox(client, user)
    assert payload["unreadNotificationCount"] == 2
    assert [item["projectTitle"] for item in payload["notifications"]] == ["Novo", "Antigo"]
    assert payload["pendingInvitationCount"] == 1

async def test_removed_member_can_mark_own_prior_notification_read(client, removed_member):
    response = await mark_notification_read(client, removed_member, notification_id)
    assert response.status_code == 200
```

Include pagination, no-project-access navigation metadata, recipient isolation, and mark-all affecting notifications but not invitations.

- [ ] **Step 2: Run targeted tests to verify they fail**

Run: `pytest backend/tests/test_notification_service.py backend/tests/test_user_inbox.py backend/tests/test_collaboration_routes.py -q`  
Expected: FAIL because only project-scoped routes and queries exist.

- [ ] **Step 3: Implement global notification queries and inbox router**

Add user-scoped list/count/read helpers. Join project and inviter display data only for inbox serialization. Register the `/api` router and remove the project-scoped notification routes so authorization no longer depends on `resolve_project_access`.

- [ ] **Step 4: Run targeted tests to verify they pass**

Run: `pytest backend/tests/test_notification_service.py backend/tests/test_user_inbox.py backend/tests/test_collaboration_routes.py -q`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app backend/tests/test_notification_service.py backend/tests/test_user_inbox.py backend/tests/test_collaboration_routes.py
git commit -m "feat: add global user inbox"
```

### Task 4: Ativar distribuição sem flag de rollout

**Files:**
- Modify: `backend/app/config.py:67-68`
- Modify: `backend/app/services/review_assignment_service.py:55-66`
- Modify: `backend/tests/test_runtime_config.py`
- Modify: `backend/tests/test_article_collaboration.py`
- Modify: `backend/tests/test_review_assignment_service.py`
- Modify: `backend/tests/test_collaboration_concurrency.py`

**Interfaces:**
- Produces: `preview_distribution` e `distribute_reviews` dependem apenas das capacidades de acesso e dados válidos do projeto.

- [ ] **Step 1: Write failing tests for distribution without an environment flag**

```python
async def test_preview_distribution_works_without_assigned_review_feature_flag(db, access):
    preview = await preview_distribution(db, access=access, phase="screening")
    assert preview.reviewer_count == 1
```

- [ ] **Step 2: Run targeted tests to verify they fail**

Run: `pytest backend/tests/test_runtime_config.py backend/tests/test_review_assignment_service.py -q`  
Expected: FAIL with `ASSIGNED_REVIEW_DISABLED` while the flag remains false or absent.

- [ ] **Step 3: Remove the rollout setting and guard**

Delete the configuration property and the guard that raises `ASSIGNED_REVIEW_DISABLED`. Preserve solo behavior based solely on whether the article has active assignments.

- [ ] **Step 4: Run targeted tests to verify they pass**

Run: `pytest backend/tests/test_runtime_config.py backend/tests/test_review_assignment_service.py backend/tests/test_article_collaboration.py -q`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/config.py backend/app/services/review_assignment_service.py backend/tests
git commit -m "fix: enable review distribution by default"
```

### Task 5: Estado e interface global da caixa de entrada

**Files:**
- Create: `frontend/src/features/inbox/services/inboxService.js`
- Create: `frontend/src/features/inbox/services/inboxService.test.js`
- Create: `frontend/src/features/inbox/hooks/useUserInbox.js`
- Create: `frontend/src/features/inbox/hooks/useUserInbox.test.jsx`
- Create: `frontend/src/features/inbox/components/UserInbox.jsx`
- Create: `frontend/src/features/inbox/components/UserInbox.test.jsx`
- Create: `frontend/src/features/inbox/context/UserInboxProvider.jsx`
- Modify: `frontend/src/components/layout/AppHeader.jsx`
- Modify: `frontend/src/components/layout/AppHeader.test.jsx`
- Modify: `frontend/src/pages/Layout.jsx`
- Modify: `frontend/src/pages/ArticleDetails.jsx`
- Modify: `frontend/src/pages/ProjectDetails.jsx`
- Modify: `frontend/src/features/collaboration/hooks/useProjectCollaboration.js`
- Delete: `frontend/src/features/collaboration/components/ProjectNotifications.jsx`
- Delete: `frontend/src/features/collaboration/components/ProjectNotifications.test.jsx`

**Interfaces:**
- Produces: `UserInboxProvider` and `useUserInbox()` with `inbox`, `attentionCount`, `refresh`, `acceptInvitation`, `declineInvitation`, `markRead`, and `markAllRead`.
- Consumes: global inbox API and React Router navigation.

- [ ] **Step 1: Write failing frontend tests for service and state**

```jsx
it("includes pending invitations in the header attention count", async () => {
  render(<UserInboxProvider><AppHeader /></UserInboxProvider>);
  expect(await screen.findByLabelText("Notificações, 3 pendentes")).toBeVisible();
});

it("accepts an invitation once and navigates only after success", async () => {
  // render a pending invitation and click Aceitar twice
  expect(apiService.post).toHaveBeenCalledTimes(1);
});
```

Cover decline, empty/error/retry states, marking global notifications, removed-access notifications without links, both desktop `AppHeader` usages, and a narrow viewport rendering assertion.

- [ ] **Step 2: Run targeted tests to verify they fail**

Run: `npx vitest run src/features/inbox src/components/layout/AppHeader.test.jsx`  
Expected: FAIL because the inbox provider and global endpoints do not exist.

- [ ] **Step 3: Implement the inbox service, provider and dialog**

Use a bounded visibility-aware 30-second polling interval in the provider. Render the bell in `AppHeader`; split the dialog into invitation cards with explicit actions and update cards with safe destinations. Reuse existing `ConfirmationDialog` only where confirmation adds value; accept/decline themselves use direct, disabled-during-submit controls.

- [ ] **Step 4: Remove project-scoped notification UI and wiring**

Delete `ProjectNotifications`, remove notification collections/actions from `useProjectCollaboration`, and remove the project-page action. Ensure `ArticleDetails` reads the same provider through `Layout`.

- [ ] **Step 5: Run targeted tests to verify they pass**

Run: `npx vitest run src/services/api.test.js src/features/inbox src/components/layout/AppHeader.test.jsx src/features/collaboration`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "feat: add global user notification center"
```

### Task 6: Integração, migração e verificação desktop direcionada

**Files:**
- Modify: `frontend/e2e/collaboration-flow.spec.js` or create `frontend/e2e/user-inbox.spec.js`
- Modify: `frontend/e2e/collaboration-fixture.js` only if fixture helpers need explicit invitation decisions
- Modify: `docs/audits/playwright-project-collaboration-2026-10-08/README.md` or create `docs/audits/playwright-user-inbox-2026-10-09/README.md`

**Interfaces:**
- Consumes: final inbox and invitation APIs, desktop frontend, isolated collaboration fixture.
- Produces: one desktop-only evidence run for accept/decline and global inbox.

- [ ] **Step 1: Write the failing desktop scenario**

```js
test("invitee chooses whether to join and sees a global inbox", async ({ browser }) => {
  // invite an existing account, prove the project stays hidden,
  // decline, re-invite, accept, then open the global bell on a non-project page.
});
```

- [ ] **Step 2: Run the scenario to verify it fails before its implementation dependencies exist**

Run: `npx playwright test e2e/user-inbox.spec.js --project=chromium`  
Expected: FAIL at missing global inbox or explicit decision behavior.

- [ ] **Step 3: Apply migrations and verify runtime configuration**

Run: `python backend/migrate_database.py`  
Expected: revision `0004_user_inbox_invitation_consent` applied without data loss.

- [ ] **Step 4: Run targeted verification after implementation**

Run: `pytest backend/tests/test_project_invitations.py backend/tests/test_user_inbox.py backend/tests/test_notification_service.py backend/tests/test_review_assignment_service.py -q`  
Run: `npm run test:ci`  
Run: `npm run lint`  
Run: `npm run build`  
Run: `npx playwright test e2e/user-inbox.spec.js --project=chromium`  
Expected: all pass; no mobile matrix is required.

- [ ] **Step 5: Capture one desktop screenshot and document evidence**

Capture the open global inbox with a pending invite and record tested behavior, browser and commit in the audit README.

- [ ] **Step 6: Commit**

```bash
git add frontend/e2e docs/audits
git commit -m "test: cover global inbox invitation flow"
```
