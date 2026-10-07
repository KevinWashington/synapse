# Project Collaboration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add internal project teams, controlled balanced review assignment, blind dual decisions, coordinator arbitration, and in-app project notifications without regressing single-user projects.

**Architecture:** PostgreSQL remains the source of truth. A centralized access resolver replaces owner-only authorization, focused collaboration services own transactions, and existing article decision routes delegate to an assigned-review orchestrator only when assignments exist. The React project workspace receives an `Equipe` tab, project notification center, assignment-aware article states, and an `Atribuídos a mim` filter.

**Tech Stack:** FastAPI, SQLAlchemy asyncio, Alembic, PostgreSQL, Pydantic v2, React 19, React Router, Vitest/Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-07-project-collaboration-design.md`

## Global Constraints

- A project must remain fully usable by one person and support any number of project members.
- Automatic distribution creates one assignment with one eligible reviewer, otherwise exactly two distinct reviewers per article.
- All active members may read all project articles; reviewer writes are restricted to assigned review work.
- Decisions stay blind until every active assignment is submitted.
- Screening reviewer pairs carry into eligibility; unavailable reviewers require explicit reassignment.
- Notifications, invitations, and acceptance remain entirely inside the platform.
- Unauthorized and nonexistent projects both return HTTP 404.
- `Article.ownerId` remains historical metadata and is not an authorization predicate after project access is resolved.
- Existing decision route URLs and request bodies remain compatible.
- Assigned-review rollout is guarded by `ASSIGNED_REVIEW_FLOW_ENABLED`; team and invitations are not.
- Administrative mutations are auditable; history is never erased by member removal or reassignment.

## Review Focus

- A removed or inactive member must immediately lose access while their historical decisions remain readable to authorized coordinators; Task 2 tests this.
- Duplicate invitation claims and repeated distribution requests must be idempotent; Tasks 3 and 4 test this.
- Concurrent second submissions must produce exactly one consolidation or one conflict; Task 5 tests row locking and uniqueness.
- A reviewer must not infer the other decision through list/detail payloads before both submit; Tasks 5 and 8 test payload redaction.
- A one-person legacy project with no assignments must preserve every existing screening and eligibility behavior; Tasks 2, 6, and 10 test this.

---

### Task 1: Collaboration schema and migration

**Files:**
- Create: `backend/app/models/collaboration.py`
- Create: `backend/migrations/versions/0003_project_collaboration.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/models/project.py`
- Modify: `backend/app/models/user.py`
- Modify: `backend/app/models/article.py`
- Modify: `backend/migrations/env.py`
- Modify: `backend/migrate_database.py`
- Test: `backend/tests/test_migrations.py`

**Interfaces:**
- Produces: `ProjectMember`, `ProjectInvitation`, `ReviewAssignment`, `ReviewDecision`, `ReviewConflict`, `ProjectNotification`, and `ProjectAuditEvent` SQLAlchemy models.
- Produces: revision `0003_project_collaboration` over `0002_google_identity_credentials`.

- [ ] **Step 1: Extend the migration tests** to assert all seven tables, foreign keys, check constraints, ordinary unique constraints, and partial unique indexes; assert upgrade preserves legacy rows and the new head is `0003_project_collaboration`.
- [ ] **Step 2: Run `cd backend; ..\.venv\Scripts\python.exe -m pytest tests\test_migrations.py -v`** and verify the new assertions fail because the collaboration schema is absent.
- [ ] **Step 3: Implement the models and migration.** Treat every assignment status except `cancelled` as occupying its slot; use `ON DELETE CASCADE` for project/article-owned data and nullable/restricting historical user references so audit history cannot disappear with a member.
- [ ] **Step 4: Import the models into Alembic and the legacy migration runner**, then run the migration test and `..\.venv\Scripts\python.exe -m alembic -c alembic.ini check`; both must pass.
- [ ] **Step 5: Commit** with `feat: add collaboration database schema`.

### Task 2: Central project access and shared project queries

**Files:**
- Create: `backend/app/services/project_access_service.py`
- Modify: `backend/app/core/dependencies.py`
- Modify: `backend/app/schemas/project.py`
- Modify: `backend/app/routers/projects.py`
- Modify: `backend/app/routers/articles.py`
- Modify: `backend/app/routers/ai.py`
- Modify: `backend/app/routers/stats.py`
- Modify: `backend/app/services/rag_service.py`
- Test: `backend/tests/test_project_access_service.py`
- Test: `backend/tests/test_collaboration_isolation.py`

**Interfaces:**
- Produces: `ProjectAccess(project, role, capabilities, participates_in_review)`.
- Produces: `resolve_project_access(db, *, project_id, user_id) -> ProjectAccess`, `require_capability(access, capability) -> None`, and `get_project_article(db, *, project_id, article_id) -> Article`.
- Produces capabilities: `read_project`, `edit_project`, `manage_members`, `manage_distribution`, `review_assigned`, `resolve_conflicts`, `reopen_review`, `delete_project`, `transfer_ownership`.

- [ ] **Step 1: Write failing access tests** for owner, active coordinator, active reviewer, inactive/foreign user 404, capability denial, removed member history, shared-project listing, and article lookup without an `ownerId` condition.
- [ ] **Step 2: Run the two focused test files** and verify failures identify missing resolver behavior.
- [ ] **Step 3: Implement the resolver and capability map**, returning the same 404 for missing and unauthorized projects.
- [ ] **Step 4: Replace owner-only read predicates** in project, article, stats, AI, and RAG paths. Keep owner-only deletion/transfer and owner-or-coordinator planning/member administration. Global dashboard totals include both owned and shared projects once each.
- [ ] **Step 5: Run focused tests plus existing `test_isolation_guards.py`, `test_traceability_contract.py`, and project/article tests**; verify all pass.
- [ ] **Step 6: Commit** with `feat: authorize shared project access`.

### Task 3: Internal invitations, membership, and ownership transfer

**Files:**
- Create: `backend/app/schemas/collaboration.py`
- Create: `backend/app/services/invitation_service.py`
- Create: `backend/app/services/notification_service.py`
- Create: `backend/app/routers/collaboration.py`
- Modify: `backend/app/routers/auth.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_project_invitations.py`
- Test: `backend/tests/test_google_auth.py`
- Test: `backend/tests/test_collaboration_routes.py`

**Interfaces:**
- Produces: `claim_pending_invitations(db, *, user) -> list[ProjectMember]`.
- Produces invitation/member CRUD and `POST /api/projetos/{projectId}/transfer-ownership`.
- Produces `create_notification(...)`, `list_notifications(...)`, `mark_notification_read(...)`, and `mark_all_notifications_read(...)`.

- [ ] **Step 1: Write failing tests** for normalized emails, existing-user immediate membership, unknown-user pending invitation, seven-day expiry, duplicate request idempotency, Google-login claim idempotency, role updates, inactive removal, ownership transfer, and non-enumerating responses.
- [ ] **Step 2: Run invitation, auth, and route tests** and verify they fail before service/router implementation.
- [ ] **Step 3: Implement schemas and transactional services.** Flush a new Google user before claiming invitations; create member/inviter notifications and audit events in the same transaction.
- [ ] **Step 4: Register the router and update the Google login transaction**, then run the focused tests and verify pass.
- [ ] **Step 5: Commit** with `feat: add internal project invitations`.

### Task 4: Controlled balanced distribution

**Files:**
- Create: `backend/app/services/review_assignment_service.py`
- Modify: `backend/app/schemas/collaboration.py`
- Modify: `backend/app/routers/collaboration.py`
- Modify: `backend/app/config.py`
- Modify: `backend/.env.example`
- Test: `backend/tests/test_review_assignment_service.py`
- Test: `backend/tests/test_collaboration_routes.py`

**Interfaces:**
- Produces: `preview_distribution(db, *, access, phase) -> DistributionPreview`.
- Produces: `distribute_reviews(db, *, access, phase) -> DistributionResult` and `reassign_review(...) -> ReviewAssignment`.
- Produces preview/distribute/reassign/me endpoints from the spec.

- [ ] **Step 1: Write failing tests** for zero eligible reviewers, one reviewer, 2+ reviewers, stable `(pending_load, user_id)` tie-breaking, maximum load difference of one, no duplicate people/slots, idempotent rerun, disabled rollout, and summarized notifications.
- [ ] **Step 2: Run the assignment tests** and verify they fail.
- [ ] **Step 3: Implement pure assignment selection and transactional persistence.** Only articles without active assignments are touched; `needs_reassignment` continues to occupy a slot.
- [ ] **Step 4: Add preview, confirmed distribution, reassignment, and personal-assignment routes**, protected by capabilities and the rollout flag.
- [ ] **Step 5: Run focused tests and commit** with `feat: distribute project reviews`.

### Task 5: Blind review decisions, consolidation, and conflicts

**Files:**
- Create: `backend/app/services/review_decision_service.py`
- Modify: `backend/app/schemas/article.py`
- Modify: `backend/app/schemas/collaboration.py`
- Modify: `backend/app/routers/articles.py`
- Modify: `backend/app/routers/collaboration.py`
- Test: `backend/tests/test_review_decision_service.py`
- Test: `backend/tests/test_collaboration_concurrency.py`
- Test: `backend/tests/test_collaboration_routes.py`

**Interfaces:**
- Produces: `submit_review_decision(...) -> ReviewSubmissionResult` with state `waiting_for_reviewer | consolidated | conflict`.
- Produces: `list_visible_decisions(...)`, `resolve_conflict(...)`, and `reopen_review(...)`.
- Consumes: Task 2 access resolver and Task 4 assignments.

- [ ] **Step 1: Write failing tests** for unassigned write denial, own-decision visibility, peer-decision redaction, single-reviewer consolidation, equal dual consolidation, divergent conflict, exactly-once concurrent finalization, required arbitration reason, reopening history, and eligibility pair inheritance.
- [ ] **Step 2: Run the decision and concurrency tests** and verify failures.
- [ ] **Step 3: Implement submission in one transaction** using `SELECT ... FOR UPDATE` on the article/active assignment set, uniqueness as a second concurrency guard, and canonical `Article` updates only after consolidation/arbitration.
- [ ] **Step 4: Make existing screening and eligibility routes delegate to the service when active assignments exist**, otherwise preserve the legacy solo flow exactly.
- [ ] **Step 5: Implement conflict list/resolve and reopen routes**, audit events, and summarized notifications.
- [ ] **Step 6: Run focused and legacy article-flow tests; commit** with `feat: add blind collaborative decisions`.

### Task 6: Frontend collaboration API and permission state

**Files:**
- Create: `frontend/src/features/collaboration/services/collaborationService.js`
- Create: `frontend/src/features/collaboration/hooks/useProjectCollaboration.js`
- Create: `frontend/src/features/collaboration/services/collaborationService.test.js`
- Create: `frontend/src/features/collaboration/hooks/useProjectCollaboration.test.jsx`
- Modify: `frontend/src/features/projects/services/projectService.js`
- Modify: `frontend/src/features/projects/hooks/useProjectDetailsPage.js`

**Interfaces:**
- Produces frontend methods matching all Task 3–5 endpoints.
- Produces hook state `{ members, invitations, assignments, conflicts, notifications, unreadCount, capabilities, loading, error }` and mutation callbacks that refresh only affected collections.

- [ ] **Step 1: Write failing service/hook tests** for URL/payload mapping, 404 handling, capability exposure, refresh after mutations, polling only while mounted, and cleanup on project change.
- [ ] **Step 2: Run `cd frontend; npx vitest run src/features/collaboration`** and verify failures.
- [ ] **Step 3: Implement the service and hook** with a 30-second notification poll only while a project is open.
- [ ] **Step 4: Expose project `role` and `capabilities` through the existing project-details hook**, run tests, and commit with `feat: add collaboration frontend state`.

### Task 7: Equipe workspace and notification center

**Files:**
- Create: `frontend/src/features/collaboration/components/ProjectTeam.jsx`
- Create: `frontend/src/features/collaboration/components/InviteMemberDialog.jsx`
- Create: `frontend/src/features/collaboration/components/DistributionPanel.jsx`
- Create: `frontend/src/features/collaboration/components/ConflictResolutionDialog.jsx`
- Create: `frontend/src/features/collaboration/components/ProjectNotifications.jsx`
- Create: matching `*.test.jsx` files
- Modify: `frontend/src/features/projects/components/ProjectDetailsHeader.jsx`
- Modify: `frontend/src/pages/ProjectDetails.jsx`
- Modify: `frontend/src/components/layout/AppHeader.jsx`

**Interfaces:**
- Consumes Task 6 hook and capability flags.
- Produces the `equipe` project tab and a project-scoped notification bell/panel.

- [ ] **Step 1: Write failing component/page tests** for role-specific controls, invite validation, ownership transfer, distribution preview + confirmation, reassignment warning, conflict reason requirement, unread count, mark-one/all read, and mobile keyboard navigation.
- [ ] **Step 2: Run focused Vitest tests** and verify failures.
- [ ] **Step 3: Implement the Equipe tab** using existing Button, Dialog, Select, Table, Card, StatusBadge, and ConfirmationDialog primitives; hide administrative controls from reviewers rather than rendering inert actions.
- [ ] **Step 4: Implement the notification bell/panel** in the project header and navigate entities to their project/article/conflict target.
- [ ] **Step 5: Run focused tests, lint, and commit** with `feat: add project team workspace`.

### Task 8: Assignment-aware article review UI

**Files:**
- Modify: `frontend/src/features/articles/services/articleService.js`
- Modify: `frontend/src/features/articles/hooks/useProjectArticles.js`
- Modify: `frontend/src/features/articles/hooks/useArticleDetailsPage.js`
- Modify: `frontend/src/features/articles/components/ProjectArticles.jsx`
- Modify: `frontend/src/features/articles/components/ArticleCard.jsx`
- Modify: `frontend/src/features/articles/components/ArticleWorkspacePanel.jsx`
- Modify: relevant existing `*.test.*` files

**Interfaces:**
- Consumes assignment metadata and submission state from Task 5.
- Produces `Atribuídos a mim` filtering and states `Aguardando minha decisão`, `Aguardando outro revisor`, `Em discordância`, and `Consolidado`.

- [ ] **Step 1: Write failing tests** for personal filtering using server totals, read-only unassigned articles, assigned-only notes/extraction writes, blind peer decisions, own submitted state, waiting/conflict/consolidated badges, and unchanged no-assignment solo behavior.
- [ ] **Step 2: Run focused article tests** and verify failures.
- [ ] **Step 3: Implement assignment-aware list/detail mapping and UI.** Never derive queue totals from the visible page; disabled decision controls must explain the missing assignment.
- [ ] **Step 4: Run all frontend unit tests and commit** with `feat: surface collaborative review states`.

### Task 9: Backup, rollout, and operational validation

**Files:**
- Modify: `scripts/verify-backup.ps1`
- Modify: `docs/deployment/data-backup.md`
- Modify: `docs/deployment/production-checklist.md`
- Test: `backend/tests/test_runtime_config.py`

**Interfaces:**
- Consumes Task 1 schema and Task 4 flag.
- Produces restore checks for every collaboration table and documented rollout/rollback procedure.

- [ ] **Step 1: Add failing config and script assertions** for the assigned-review flag and collaboration table/orphan checks.
- [ ] **Step 2: Implement configuration parsing and extend restore verification** with counts plus orphan queries for members, invitations, assignments, decisions, conflicts, notifications, and audit events.
- [ ] **Step 3: Document migration order, flag enablement, smoke tests, rollback behavior, and dump restoration checks.**
- [ ] **Step 4: Run config tests and PowerShell syntax validation; commit** with `docs: add collaboration deployment checks`.

### Task 10: End-to-end regression and product review

**Files:**
- Create: `frontend/e2e/collaboration-flow.spec.js`
- Modify: `frontend/e2e/article-flow-stability.spec.js`
- Modify: `frontend/e2e/product-audit.spec.js`

**Interfaces:**
- Consumes all previous tasks.
- Produces browser-level evidence for solo and collaborative workflows.

- [ ] **Step 1: Write Playwright scenarios** for legacy solo review, existing-user invitation, pending invitation claimed on Google login fixture, balanced two-reviewer distribution, hidden first decision, agreement consolidation, disagreement arbitration, personal filtering, notification navigation, and reviewer write denial.
- [ ] **Step 2: Run the new spec before final wiring is complete** and verify it catches any missing behavior.
- [ ] **Step 3: Fix only root causes found by E2E**, adding a focused unit/integration regression test for every defect before the production fix.
- [ ] **Step 4: Run full verification:** backend pytest, migration test, Alembic check, `npm run test:ci`, `npm run lint`, `npm run build`, and Playwright desktop + mobile collaboration/product flows.
- [ ] **Step 5: Capture and inspect final screenshots** for Equipe, distribution preview, blind waiting state, conflict resolution, and notification panel at desktop and Pixel 7 widths; correct clipping, hierarchy, focus, and pointer affordances.
- [ ] **Step 6: Request an independent whole-branch code review**, address valid findings with tests, repeat full verification, and commit with `test: verify collaborative review workflow`.
