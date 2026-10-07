# Identification Flow and Project UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make identification reliable beyond 100 records and stabilize the project header and dashboard layout.

**Architecture:** Add one transactional bulk-promotion endpoint that refreshes duplicate markers and advances only unique identification records. Keep the article list paginated with server totals, and expose the existing duplicate-decision backend through a focused review component. UI-only layout changes remain isolated in the header and overview components.

**Tech Stack:** FastAPI, SQLAlchemy async, Pydantic, React 19, Vitest, Testing Library, Tailwind CSS, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-06-identification-flow-polish.md`

## Global Constraints

- Never auto-remove suspected duplicates.
- Never limit the bulk action to the currently loaded page.
- Preserve project/owner isolation.
- Preserve pre-existing uncommitted user changes.
- Use Portuguese user-facing copy.

## Review Focus

- A project with 1,093 records and a 100-row page reports 1,093 as the total and 100 as loaded.
- A duplicate group split across list pages remains excluded from bulk promotion.
- Active records already in screening are not reprocessed by identification deduplication.
- An empty identification queue returns zero counts without an error.
- A long project objective keeps the same header height while switching tabs and at narrow widths.

---

### Task 1: Server-side promotion of every unique identification record

**Files:**
- Modify: `backend/app/routers/articles.py`
- Modify: `backend/app/schemas/article.py`
- Create: `backend/tests/test_identification_bulk_promotion.py`

**Interfaces:**
- Produces: `POST /api/projetos/{projectId}/artigos/promote-unique-to-screening` returning `projectId`, `movedCount`, `unresolvedDuplicateGroups`, and `unresolvedDuplicateRecords`.

- [ ] Write failing tests proving unique active identification records move, suspected groups stay, non-identification records remain untouched, and empty input returns zeros.
- [ ] Run the targeted pytest file and confirm failures are caused by the missing behavior.
- [ ] Implement a small domain helper plus the owner-scoped endpoint and response schema.
- [ ] Run the targeted tests and the existing backend article tests.
- [ ] Commit only the files owned by this task.

### Task 2: Total-aware pagination and bulk action client contract

**Files:**
- Modify: `frontend/src/features/articles/services/articleService.js`
- Modify: `frontend/src/features/articles/hooks/useProjectArticles.js`
- Modify: `frontend/src/features/articles/components/ProjectArticles.jsx`
- Modify: `frontend/src/features/articles/components/ProjectArticles.test.jsx`
- Create: `frontend/src/features/articles/services/articleService.test.js`

**Interfaces:**
- Consumes: Task 1 bulk endpoint and response.
- Produces: list state `articleTotal`, `articlePage`, pagination handlers, and `promoteAllUniqueToScreening()`.

- [ ] Write failing service and component tests for the new endpoint, total/loaded copy, pagination controls, and primary bulk action.
- [ ] Run targeted Vitest tests and confirm expected failures.
- [ ] Implement page-aware loading, server total display, navigation, and bulk action while retaining selected promotion.
- [ ] Run targeted tests and the frontend unit suite.
- [ ] Commit the task files.

### Task 3: Manual duplicate review surface

**Files:**
- Modify: `frontend/src/features/articles/components/ProjectArticles.jsx`
- Modify: `frontend/src/features/articles/components/ProjectArticles.test.jsx`

**Interfaces:**
- Consumes: existing `duplicateCandidates`, `selectedDuplicateMap`, `setSelectedDuplicateMap`, and `applyDuplicateReview` hook API.
- Produces: visible canonical-record selection and apply action for every group.

- [ ] Write failing component tests for group rendering, canonical selection, and apply action.
- [ ] Run the targeted test and confirm the missing UI failure.
- [ ] Implement the review panel and connect the existing hook operations.
- [ ] Run the targeted test and frontend suite.
- [ ] Commit the task files.

### Task 4: Stable project header and balanced dashboard

**Files:**
- Modify: `frontend/src/features/projects/components/ProjectDetailsHeader.jsx`
- Modify: `frontend/src/features/projects/components/ProjectOverview.jsx`
- Create: `frontend/src/features/projects/components/ProjectDetailsHeader.test.jsx`
- Create: `frontend/src/features/projects/components/ProjectOverview.test.jsx`

**Interfaces:**
- Produces: stable project identity header and balanced overview grid semantics.

- [ ] Write failing behavior tests for invariant title/objective and balanced card regions.
- [ ] Run the targeted tests and confirm expected failures.
- [ ] Remove per-tab header copy, reserve a two-line objective region, and replace asymmetric narrow dashboard tracks with balanced responsive spans.
- [ ] Run targeted tests and the frontend suite.
- [ ] Commit the task files.

### Task 5: End-to-end production-flow verification

**Files:**
- Modify or create only focused Playwright specs if reusable automation is needed.
- Capture evidence under `docs/audits/`.

**Interfaces:**
- Consumes: completed backend and frontend behavior.

- [ ] Run backend tests, frontend tests, lint, and production build.
- [ ] Exercise pagination, total count, duplicate review, bulk unique promotion, tab header stability, and dashboard desktop/mobile layouts in Playwright.
- [ ] Capture screenshots and record any remaining issue.
- [ ] Fix any Critical or Important finding with a RED-GREEN test cycle and rerun verification.
