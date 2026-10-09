# Unified Review Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the adaptive workspace the primary surface for screening, PDF-based eligibility, and included-study extraction while keeping the article detail route optional.

**Architecture:** Keep `ProjectArticles` as the orchestration boundary and reuse `PdfViewer` and `ArticleEvidenceEditor` inside stage-aware center/tool components. Add small pure presentation helpers for queue state and decision history, then load selected-article detail/PDF data only when the active stage needs it.

**Tech Stack:** React 19, React Router, Vitest/Testing Library, Tailwind CSS, existing article services and design tokens.

**Spec:** `docs/superpowers/specs/2026-10-09-unified-review-workspace-design.md`

## Global Constraints

- No backend schema or review-consolidation rule changes.
- Reuse `PdfViewer`, `ArticleEvidenceEditor`, and current article service endpoints.
- Keep `ArticleDetails` available only as an optional focus view.
- Preserve collaborative privacy: only render decision payloads already visible in `reviewDecisions`.
- Keep dirty-state confirmation for article, filter, page, stage, and route changes.
- Use existing Lucide icons and Synapse design tokens; no new visual dependency.

## Review Focus

- A collaborative submission may be visible before consolidation; show only the current user's submission and never infer peer content.
- An included project may have no extraction schema; show useful progress text without `0/0` or a blocked editor.
- A PDF request can become stale when the selected article changes; discard stale responses and clear the previous document immediately.
- Extraction values may be arrays, booleans, zero, or whitespace; count meaningful values without treating `0` or `false` as empty.
- Narrow queue rows must never acquire horizontal scrolling from long titles, statuses, dates, or menus.

---

### Task 1: Compact queue states and extraction progress

**Files:**
- Create: `frontend/src/features/articles/utils/reviewWorkspace.js`
- Create: `frontend/src/features/articles/utils/reviewWorkspace.test.js`
- Modify: `frontend/src/features/articles/components/review/ReviewQueuePanel.jsx`
- Modify: `frontend/src/features/articles/components/review/ReviewQueuePanel.test.jsx`
- Modify: `frontend/src/features/articles/components/ProjectArticles.jsx`

**Interfaces:**
- Produces: `hasExtractionValue(value) -> boolean`, `getExtractionProgress(article, schema) -> { completed, total, state, label }`, and `getQueueStatus(article, stageKey, duplicateIds, schema) -> { label, className, dot, tooltip }`.
- Consumes: current article collaboration fields, `extractionData`, `extractionCompletedAt`, and `project.dataExtractionSchema`.

- [ ] **Step 1: Write the failing utility tests**

Cover short collaboration labels (`Minha vez`, `Aguardando pares`, `Em revisão`, `Discordância`, `Consolidado`, `Redistribuir`) and extraction states (`Não iniciada`, `Em andamento 2/3`, `Concluída`), including `0`, `false`, arrays, whitespace, and a missing schema.

- [ ] **Step 2: Run the utility test and verify RED**

Run: `npm --prefix frontend test -- --run src/features/articles/utils/reviewWorkspace.test.js`
Expected: FAIL because `reviewWorkspace.js` does not exist.

- [ ] **Step 3: Implement the pure helpers**

`getQueueStatus` must preserve identification/screening/eligibility outcome colors but use short collaboration copy outside Inclusion; Inclusion must always prioritize extraction progress.

- [ ] **Step 4: Run the utility test and verify GREEN**

Run: `npm --prefix frontend test -- --run src/features/articles/utils/reviewWorkspace.test.js`
Expected: all tests pass.

- [ ] **Step 5: Write failing queue component tests**

Assert the status is inside the article button's lower metadata row, the title container has `min-w-0`, no row child uses the former `max-w-44` side badge, and Inclusion receives the schema and renders extraction status.

- [ ] **Step 6: Run the queue component test and verify RED**

Run: `npm --prefix frontend test -- --run src/features/articles/components/review/ReviewQueuePanel.test.jsx`
Expected: FAIL against the current side-column status.

- [ ] **Step 7: Recompose `ReviewQueuePanel` and wire the schema**

Add `extractionSchema` prop, render status below article metadata, keep date/menu at the row bottom-right, and update `filterArticles` to use extraction state for pending items.

- [ ] **Step 8: Run focused tests and commit**

Run: `npm --prefix frontend test -- --run src/features/articles/utils/reviewWorkspace.test.js src/features/articles/components/review/ReviewQueuePanel.test.jsx src/features/articles/components/ProjectArticles.test.jsx`
Expected: all selected tests pass.

Commit: `feat: clarify review queue status`

---

### Task 2: Visible individual and consolidated decision history

**Files:**
- Create: `frontend/src/features/articles/components/review/DecisionHistory.jsx`
- Create: `frontend/src/features/articles/components/review/DecisionHistory.test.jsx`
- Modify: `frontend/src/features/articles/components/review/ArticleReadingPane.jsx`
- Modify: `frontend/src/features/articles/components/review/ReviewStageTools.test.jsx`
- Modify: `frontend/src/features/articles/components/review/ScreeningDecisionTool.jsx`
- Modify: `frontend/src/features/articles/components/review/EligibilityDecisionTool.jsx`

**Interfaces:**
- Produces: `<DecisionHistory article phase />`, deriving the current user's payload from `reviewDecisions` and `myReviewAssignment.reviewerUserId` and the canonical result from phase fields.
- Consumes: article decision fields only; it never fetches or mutates data.

- [ ] **Step 1: Write failing decision-history tests**

Assert a submitted collaborative article renders `Sua decisão`, its own reason, and no private peer reason while incomplete; a consolidated article also renders `Decisão consolidada`; a missing reason renders `Nenhuma justificativa informada`; a non-managed article avoids duplicate sections.

- [ ] **Step 2: Run the component test and verify RED**

Run: `npm --prefix frontend test -- --run src/features/articles/components/review/DecisionHistory.test.jsx`
Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement `DecisionHistory` and insert it in the reading pane**

Place history below the screening summary and in the eligibility fallback/header context. When `review.canDecide` is false, decision tools keep explanatory state but do not rely on the disabled textarea to communicate saved content.

- [ ] **Step 4: Add integration assertions for screening and eligibility**

Update `ReviewStageTools.test.jsx` to prove history appears for the correct phase and that the central wrapper is fluid rather than `max-w-[760px]`.

- [ ] **Step 5: Run focused tests and commit**

Run: `npm --prefix frontend test -- --run src/features/articles/components/review/DecisionHistory.test.jsx src/features/articles/components/review/ReviewStageTools.test.jsx src/features/articles/components/review/ScreeningDecisionTool.test.jsx src/features/articles/components/review/EligibilityDecisionTool.test.jsx`
Expected: all selected tests pass.

Commit: `feat: show review decision history`

---

### Task 3: Embedded eligibility PDF with safe selected-article loading

**Files:**
- Create: `frontend/src/features/articles/hooks/useWorkspaceArticle.js`
- Create: `frontend/src/features/articles/hooks/useWorkspaceArticle.test.jsx`
- Modify: `frontend/src/features/articles/components/review/ArticleReadingPane.jsx`
- Modify: `frontend/src/features/articles/components/review/ReviewStageTools.test.jsx`
- Modify: `frontend/src/features/articles/components/ProjectArticles.jsx`

**Interfaces:**
- Produces: `useWorkspaceArticle({ projectId, article, activeStage }) -> { article: detailedArticle, pdfData, isLoadingArticle, isLoadingPdf, refreshArticle }`.
- Consumes: `articleService.getArticleById(projectId, article.id)` and `articleService.getPdfData(projectId, article.id)`; requests are eligibility/included-only and stale responses are ignored.

- [ ] **Step 1: Write failing hook tests**

Assert detail loading merges the selected article, eligibility with PDF loads `ArrayBuffer`, selection changes clear old PDF, stale response is ignored, and screening does not request PDF.

- [ ] **Step 2: Run the hook test and verify RED**

Run: `npm --prefix frontend test -- --run src/features/articles/hooks/useWorkspaceArticle.test.jsx`
Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement the hook**

Use request sequence refs like `useProjectArticles`; return the list article immediately while detail loads and clear `pdfData` synchronously on identity/stage change.

- [ ] **Step 4: Write failing reading-pane tests**

Mock `PdfViewer` at the external boundary and assert Eligibility renders it with the detailed article and buffer; no-PDF state renders summary plus `Enviar PDF`; `Abrir em modo de foco` remains secondary.

- [ ] **Step 5: Run the reading-pane test and verify RED**

Run: `npm --prefix frontend test -- --run src/features/articles/components/review/ReviewStageTools.test.jsx`
Expected: FAIL because Eligibility still renders the abstract block.

- [ ] **Step 6: Embed `PdfViewer` and wire `useWorkspaceArticle`**

Make the center panel a full-height flex region for Eligibility and pass focus/upload callbacks without changing the route contract.

- [ ] **Step 7: Run focused tests and commit**

Run: `npm --prefix frontend test -- --run src/features/articles/hooks/useWorkspaceArticle.test.jsx src/features/articles/components/review/ReviewStageTools.test.jsx src/features/articles/components/PdfViewer.test.jsx`
Expected: all selected tests pass.

Commit: `feat: embed eligibility pdf in workspace`

---

### Task 4: Inline included-study extraction

**Files:**
- Modify: `frontend/src/features/articles/components/review/ArticleReadingPane.jsx`
- Modify: `frontend/src/features/articles/components/review/IncludedExtractionTool.jsx`
- Modify: `frontend/src/features/articles/components/review/ReviewStageTools.test.jsx`
- Modify: `frontend/src/features/articles/components/ProjectArticles.jsx`
- Modify: `frontend/src/features/articles/components/ProjectArticles.test.jsx`

**Interfaces:**
- Consumes: `ArticleEvidenceEditor({ article, project, isSaving, onSave, onDirtyChange?, formId? })`, `articleService.updateArticleEvidence(projectId, articleId, payload)`, and Task 1 `getExtractionProgress`.
- Produces: inline save handler that replaces the selected/list article with the server response, refreshes the selection summary, and clears dirty state only after success.

- [ ] **Step 1: Write failing center/tool tests**

Assert Inclusion renders the real editor in the center, the contextual tool shows completed/total and pending field names, the main action submits the editor form instead of navigating, and missing-schema/read-only states remain usable.

- [ ] **Step 2: Run stage-tool tests and verify RED**

Run: `npm --prefix frontend test -- --run src/features/articles/components/review/ReviewStageTools.test.jsx`
Expected: FAIL because Inclusion still renders a read-only summary.

- [ ] **Step 3: Add dirty-state support to `ArticleEvidenceEditor` if absent**

Expose `onDirtyChange(boolean)` based on the extraction/quality values compared with the selected article, resetting on article change and successful save. Add its failing test before changing the component.

- [ ] **Step 4: Implement the inline editor and contextual progress tool**

Give the editor a stable form id owned by the workspace. Replace `Abrir extração` with `Salvar rascunho`/completion controls targeting that form, plus the optional focus-view action.

- [ ] **Step 5: Write failing orchestration test**

In `ProjectArticles.test.jsx`, submit extraction, assert `updateArticleEvidence` receives the selected id/payload, summary refreshes, and the updated progress replaces the row without navigation.

- [ ] **Step 6: Implement save orchestration and guard integration**

Use the detailed selected article from Task 3, preserve rascunho on failure, update local list/detail on success, and include extraction dirty state in `useReviewDraftGuard`.

- [ ] **Step 7: Run focused tests and commit**

Run: `npm --prefix frontend test -- --run src/features/articles/components/ArticleEvidenceEditor.test.jsx src/features/articles/components/review/ReviewStageTools.test.jsx src/features/articles/components/ProjectArticles.test.jsx`
Expected: all selected tests pass.

Commit: `feat: move extraction into review workspace`

---

### Task 5: Responsive polish, regression verification, and visual QA

**Files:**
- Modify: `frontend/src/features/articles/components/review/AdaptiveReviewWorkspace.jsx`
- Modify: `frontend/src/features/articles/components/review/AdaptiveReviewWorkspace.test.jsx`
- Modify: `frontend/src/features/articles/components/review/ArticleReadingPane.jsx`
- Modify: `frontend/src/features/articles/components/review/ReviewQueuePanel.jsx`
- Create: `design-qa.md`

**Interfaces:**
- Consumes: all prior task components.
- Produces: stage-aware mobile tab label (`Extração` for the included center region), stable desktop proportions, and QA evidence for desktop and mobile.

- [ ] **Step 1: Write failing responsive tests**

Assert the included center tab is named `Extração`, other stages retain `Artigo`, and all desktop regions keep `min-w-0`/overflow containment.

- [ ] **Step 2: Run responsive tests and verify RED**

Run: `npm --prefix frontend test -- --run src/features/articles/components/review/AdaptiveReviewWorkspace.test.jsx`
Expected: FAIL because labels are static.

- [ ] **Step 3: Implement responsive labels and containment**

Pass `activeStage` into the workspace and keep queue/content/tool proportions consistent with the approved desktop design.

- [ ] **Step 4: Run the complete automated verification**

Run: `npm --prefix frontend run test:ci`
Expected: all Node and Vitest tests pass with zero failures.

Run: `npm --prefix frontend run lint`
Expected: exit 0 with no errors.

Run: `npm --prefix frontend run build`
Expected: exit 0 and Vite production build output.

- [ ] **Step 5: Run browser design QA**

Start the existing frontend dev server, capture the authenticated/mock review workspace at 1440 px and 390 px, compare the queue, central content, PDF/fallback, decision history, and extraction states with the approved screenshots/spec, test primary interactions, and check console errors. Save evidence and the required report in `design-qa.md`; fix all P0/P1/P2 issues until `final result: passed` or record an external blocker as `blocked`.

- [ ] **Step 6: Commit final polish and QA evidence**

Commit: `test: verify unified review workspace`
