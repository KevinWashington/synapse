# Article Flow Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every article-stage queue, decision, workspace, header, and project-tab transition accurate and predictable at production scale.

**Architecture:** Treat the URL and server pagination metadata as the authoritative navigation and queue state. Reuse shared confirmation and authenticated-header components across the normal layout and focused article workspaces, while keeping extraction mounted as one stable workspace with local PDF/notes switching.

**Tech Stack:** React 19, React Router 7, Vitest/Testing Library, Playwright, FastAPI/SQLAlchemy, pytest, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-10-06-article-flow-stability-design.md`

## Global Constraints

- Do not mutate project 7 during tests or manual verification.
- Keep server-side article pages at 20 records.
- Do not add frontend or backend dependencies.
- Preserve unrelated user changes in `backend/app/models/article.py`, `backend/app/routers/articles.py`, `backend/app/services/ai_service.py`, and untracked files.
- Use Portuguese interface copy with existing product terminology.
- Run every behavior change through a failing test before implementation.
- Keep exclusion history in summaries/reports, never in active screening or eligibility queues.

## Review Focus

- Concurrent `tab` and `flow` changes: one URL update must not be overwritten by an unmounting child.
- A decision that empties the last page: return to the last valid page instead of showing a false empty queue.
- Missing AI justification: hide the copy action and retain manual entry behavior.
- Cancelled confirmations: never call the mutation and never discard unsaved extraction values.
- Browser back/forward and invalid query parameters: resolve once to a valid tab/workspace without loops.

---

### Task 1: Make project navigation URL-authoritative

**Files:**
- Create: `frontend/src/features/projects/hooks/useProjectDetailsPage.test.jsx`
- Modify: `frontend/src/features/projects/hooks/useProjectDetailsPage.js`
- Modify: `frontend/src/features/articles/hooks/useProjectArticles.js`
- Modify: `frontend/src/features/articles/components/ProjectArticles.jsx`

**Interfaces:**
- Produces: `activeTab` derived from the current `tab` query parameter.
- Produces: `setActiveTab(nextTab: string)` performing one atomic query update.
- Preserves: `setActiveFlowTab(nextFlow: string)` with `tab=artigos` and a valid `flow` in the same URL.

- [x] **Step 1: Write failing navigation tests**

Cover Visão Geral → Planejamento, Planejamento → Artigos, Fluxo → Artigos, nested flow changes, browser back/forward, and invalid `tab`/`flow`. Assert one click produces the final URL and content without an intermediate return.

- [x] **Step 2: Run the focused test and verify the current mirrored state fails**

Run: `npm run test:ci -- --run src/features/projects/hooks/useProjectDetailsPage.test.jsx`

- [x] **Step 3: Remove mirrored tab state and conflicting effects**

Derive `activeTab` from `searchParams`; preserve `flow` only for `tab=artigos`; remove the `ProjectArticles` effect that rewrites overview/report after mount; default an absent article flow directly to `identification`.

- [x] **Step 4: Run navigation and existing project-header tests**

Run: `npm run test:ci -- --run src/features/projects/hooks/useProjectDetailsPage.test.jsx src/features/projects/components/ProjectDetailsHeader.test.jsx`

- [x] **Step 5: Commit**

Commit: `fix: make project tab navigation URL authoritative`

### Task 2: Make stage queues server-accurate and vertically stable

**Files:**
- Create: `frontend/src/features/articles/hooks/useProjectArticles.test.jsx`
- Modify: `frontend/src/features/articles/hooks/useProjectArticles.js`
- Modify: `frontend/src/features/articles/components/ProjectArticles.jsx`
- Modify: `frontend/src/features/articles/components/ProjectArticles.test.jsx`

**Interfaces:**
- Consumes: article-list response `{ articles, total, page, limit }`.
- Produces: screening/eligibility requests with `{ phase, outcome: "active", page, limit: 20 }`.
- Produces: work-queue footer and badge using `articleTotal`, never page length.

- [x] **Step 1: Write failing queue tests**

Assert active-outcome request filters, a single `Na fila` filter for screening/eligibility, exact server totals, no excluded row, one `Resumo` label, and flex classes that pin the footer below a growing scroll region.

- [x] **Step 2: Run the focused tests and verify failures**

Run: `npm run test:ci -- --run src/features/articles/hooks/useProjectArticles.test.jsx src/features/articles/components/ProjectArticles.test.jsx`

- [x] **Step 3: Implement active queues and layout**

Add `outcome: "active"` to screening/eligibility filters, stop deriving global counts from the loaded page, simplify their filters, make the stage card a full-height flex column, let the list consume remaining height, pin the footer with `mt-auto`, and remove the duplicate summary heading.

- [x] **Step 4: Handle a now-empty last page**

When a refresh returns zero rows with `page > 1` and `total > 0`, set the page to `ceil(total / 20)` and fetch that page once. Add the case to the hook test.

- [x] **Step 5: Run focused tests**

Expected: all queue tests pass.

- [x] **Step 6: Commit**

Commit: `fix: align article queues with server totals`

### Task 3: Add reusable confirmation for consequential actions

**Files:**
- Create: `frontend/src/components/ui/ConfirmationDialog.jsx`
- Create: `frontend/src/components/ui/ConfirmationDialog.test.jsx`
- Modify: `frontend/src/features/articles/components/ArticleEvidenceEditor.jsx`
- Create: `frontend/src/features/articles/components/ArticleEvidenceEditor.test.jsx`
- Modify: `frontend/src/features/articles/components/ProjectArticles.jsx`
- Modify: `frontend/src/pages/ArticleDetails.jsx`
- Modify: `frontend/src/pages/ProjectDetails.jsx`
- Modify: `frontend/src/pages/Projects.jsx`
- Modify: `frontend/src/features/articles/hooks/useArticleDetailsPage.js`
- Modify: `frontend/src/features/projects/hooks/useProjectDetailsPage.js`
- Modify: `frontend/src/features/projects/hooks/useProjectsPage.js`

**Interfaces:**
- Produces: `ConfirmationDialog({ open, title, description, confirmLabel, cancelLabel, tone, isPending, onConfirm, onOpenChange })`.
- Produces: extraction completion confirmation that submits the current payload with `markExtractionComplete: true` only after confirmation.
- Removes: all `window.confirm` calls in the touched project/article deletion flows.

- [x] **Step 1: Write failing generic-dialog tests**

Assert accessible title/description, cancel closes without mutation, confirm calls once, and pending state disables both actions.

- [x] **Step 2: Implement the shared dialog using the existing Radix dialog primitives**

Run: `npm run test:ci -- --run src/components/ui/ConfirmationDialog.test.jsx`

- [x] **Step 3: Write failing extraction-completion tests**

Assert draft saves immediately, complete opens the modal, cancel leaves entered field values intact and does not call `onSave`, and confirm calls `onSave` once with the current values and completion flag.

- [x] **Step 4: Integrate confirmation into the editor and make tests pass**

Keep the pending payload inside `ArticleEvidenceEditor` so every rendering variant follows the same completion rule.

- [x] **Step 5: Add confirmations to bulk promotion, duplicate application, article deletion, and project deletion**

Move deletion confirmation state into the rendering page; hooks expose mutation callbacks without invoking native dialogs. Extend relevant tests to prove cancel/confirm behavior.

- [x] **Step 6: Run all touched tests and commit**

Commit: `feat: confirm consequential workflow actions`

### Task 4: Restrict review tools by stage and copy AI justification safely

**Files:**
- Modify: `frontend/src/features/articles/components/ScreeningDecisionDialog.jsx`
- Modify: `frontend/src/features/articles/components/ScreeningDecisionDialog.test.jsx`
- Modify: `frontend/src/features/articles/components/ArticleWorkspacePanel.jsx`
- Create: `frontend/src/features/articles/components/ArticleWorkspacePanel.test.jsx`
- Modify: `frontend/src/pages/ArticleDetails.jsx`
- Modify: `frontend/src/features/articles/hooks/useArticleDetailsPage.js`

**Interfaces:**
- Produces: `ArticleWorkspacePanel` prop `activeFlow: "screening" | "eligibility" | "included"`.
- Produces: allowed tabs `notas/chat` for screening and eligibility.
- Produces: optional `Usar justificativa da IA` action using `article.aiEvaluation`.

- [x] **Step 1: Write failing AI-copy tests**

Assert the action is absent without AI text; when present it fills the textarea, remains editable, does not change the decision, and does not submit before `Salvar decisão`.

- [x] **Step 2: Implement AI copy and run the dialog test**

Run: `npm run test:ci -- --run src/features/articles/components/ScreeningDecisionDialog.test.jsx`

- [x] **Step 3: Write failing stage-tab tests**

Assert triagem/elegibilidade render only Notas and Assistente IA; an invalid `workspace=extracao` resolves to Notas; the standalone Assistente IA header button is absent.

- [x] **Step 4: Implement stage-aware tabs and URL normalization**

Pass `activeFlow` from the review workspace and normalize an invalid `rightTab` once without a navigation loop.

- [x] **Step 5: Run focused tests and commit**

Commit: `fix: show only valid article review tools`

### Task 5: Share the authenticated header and breadcrumb language

**Files:**
- Create: `frontend/src/components/layout/AppHeader.jsx`
- Create: `frontend/src/components/layout/AppHeader.test.jsx`
- Modify: `frontend/src/components/layout/index.js`
- Modify: `frontend/src/pages/Layout.jsx`
- Modify: `frontend/src/pages/ProjectDetails.jsx`
- Modify: `frontend/src/pages/ArticleDetails.jsx`
- Modify: `frontend/src/context/pageTitleContext.jsx`

**Interfaces:**
- Produces: `AppHeader({ breadcrumbs, title, backUrl, actions, compact })`.
- Breadcrumb item: `{ label: string, href?: string }`.
- Account controls consume authenticated user/logout internally and always show theme, avatar, name/email menu, and logout.

- [x] **Step 1: Write failing shared-header tests**

Assert chevron breadcrumbs, clickable ancestors, authenticated avatar image/fallback, account menu, theme control, and no hard-coded `JS` identity.

- [x] **Step 2: Implement `AppHeader` and migrate `Layout`**

Extend page-title context with `breadcrumbs`; keep first-level pages without synthetic breadcrumb entries.

- [x] **Step 3: Migrate project and article workspaces**

Use `Projetos > projeto > seção` in project/article internals. Preserve the focused workspace without sidebar while rendering the same 72px header and real account controls.

- [x] **Step 4: Run header, layout, and project tests**

Run: `npm run test:ci -- --run src/components/layout/AppHeader.test.jsx src/features/projects/components/ProjectDetailsHeader.test.jsx`

- [x] **Step 5: Commit**

Commit: `feat: unify internal headers and breadcrumbs`

### Task 6: Keep extraction in one stable PDF/notes workspace

**Files:**
- Modify: `frontend/src/pages/ArticleDetails.jsx`
- Create: `frontend/src/pages/ArticleDetails.test.jsx`
- Modify: `frontend/src/features/articles/hooks/useArticleDetailsPage.js`

**Interfaces:**
- Produces: extraction-left state `"pdf" | "notas"` local to `PrismaExtractionWorkspace`.
- Consumes: existing `onSaveNotes(notes)` callback.
- Preserves: the mounted `ArticleEvidenceEditor` while the left panel switches.

- [x] **Step 1: Write failing extraction-workspace tests**

Assert no `Ver detalhes do artigo`, functional PDF/Notas tabs, saving notes, unchanged form values after both tab switches, and next/previous URLs retaining `flow=included&workspace=extracao`.

- [x] **Step 2: Implement local PDF/notes switching**

Pass `onSaveNotes` into the extraction workspace, render `NotesEditor` in the left panel, and remove navigation to the review workspace.

- [x] **Step 3: Run focused tests and commit**

Commit: `fix: keep extraction context while viewing notes`

### Task 7: Validate bulk promotion at scale and improve connection feedback

**Files:**
- Modify: `backend/tests/test_identification_bulk_promotion.py`
- Modify: `frontend/src/features/articles/hooks/useProjectArticles.js`
- Modify: `frontend/src/features/articles/hooks/useProjectArticles.test.jsx`
- Modify only if required by failing scale test: `backend/app/routers/articles.py` in the promotion helper/route region.

**Interfaces:**
- Preserves: `POST /api/projetos/{projectId}/artigos/promote-unique-to-screening` response fields.
- Produces: connection-specific toast when `ApiError.status === 0`.
- Preserves: idempotent promotion across repeated calls.

- [x] **Step 1: Extend backend tests to more than two frontend pages**

Use at least 45 unique records plus a duplicate group. Assert every unique advances, duplicates remain, and a second helper call moves zero records.

- [x] **Step 2: Run backend scale tests**

Run: `python -m pytest backend/tests/test_identification_bulk_promotion.py -q`

- [x] **Step 3: Write and implement the frontend connection-error test**

Mock a status-0 API error and assert the toast says the server is unavailable and the local queue remains unchanged. Preserve backend-provided messages for nonzero statuses.

- [x] **Step 4: Optimize the backend only if the scale test or timed local endpoint proves it necessary**

Keep edits isolated from the existing unrelated hunks in `articles.py`; group similarity candidates by year before pair comparisons without changing DOI/title-year rules.

- [x] **Step 5: Run backend/frontend focused tests and commit**

Commit: `fix: harden bulk identification promotion`

### Task 8: Exercise the complete flow with Playwright and production checks

**Files:**
- Create: `frontend/e2e/article-flow-stability.spec.js`
- Modify if reusable helpers are needed: existing Playwright support/config files only.
- Update: `docs/superpowers/plans/2026-10-07-article-flow-stability.md` checkboxes as tasks finish.

**Interfaces:**
- Uses a disposable project created for the test; never uses project 7.
- Covers viewport widths used by existing desktop audits.

- [x] **Step 1: Add the end-to-end scenario**

Create/import more than 20 articles with a duplicate pair; promote all uniques; make screening and eligibility decisions; copy/edit AI justification; confirm queue totals/pagination; open extraction; switch PDF/Notas; cancel then confirm completion; navigate included articles; traverse every project tab; test back/forward; verify shared account header.

- [x] **Step 2: Start/restart local containers and Vite only if needed**

Verify with `docker ps`; use the repository compose setup and hidden Vite process already established for this workspace.

- [x] **Step 3: Run the focused Playwright spec**

Run: `npm run test:e2e -- e2e/article-flow-stability.spec.js`

- [x] **Step 4: Run full verification**

Run frontend unit tests, lint, production build, backend focused tests, and the complete Playwright suite. Confirm no test mutated project 7.

- [x] **Step 5: Inspect key screenshots manually**

Check the queue footer alignment, header consistency, breadcrumbs, modal hierarchy, and extraction PDF/Notas layout at desktop and a narrower responsive width.

- [x] **Step 6: Commit final tests/documentation**

Commit: `test: cover stable article workflow end to end`
