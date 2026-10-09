# Adaptive Review Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one responsive review workspace whose stable navigation, queue, reading area, and contextual tool adapt across Identification, Screening, Eligibility, and Inclusion.

**Architecture:** Keep fetching, authorization, pagination, and mutations in `useProjectArticles`; decompose the current monolithic page into a shell plus stage-specific tools. Extract reusable decision forms from the existing dialogs so the new inline panels and the article-detail modals share validation and AI behavior instead of duplicating rules.

**Tech Stack:** React 19, React Router 7, Tailwind CSS 4, Lucide React, Vitest, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-09-adaptive-review-workspace-design.md`

## Global Constraints

- Do not change API contracts or the data model.
- Preserve current PRISMA rules, permissions, collaboration states, pagination totals, and decision validation.
- AI output is always labeled and handled as a draft; it never submits a human decision.
- Identification and Inclusion must retain all current capabilities inside the shared shell.
- Use existing design-system tokens, Button/Input/Textarea primitives, and Lucide icons; add no dependency.
- Desktop shows three regions; compact desktop/tablet can collapse the queue; mobile uses Fila, Artigo, and Decisão segments.
- All existing tests must continue to pass.
- Run all `npm` commands in this plan from the `frontend/` directory.

## Review Focus

- A 1,093-item server-side queue must retain its true total, page controls, filters, and selected item when the shell changes layout; Task 2 tests this.
- Switching article or stage with an edited, unsaved decision must warn instead of silently discarding it; Task 6 tests this.
- A collaboration assignment can become read-only while the article is open; Task 4 tests that actions disable and explain why.
- `I`, `E`, and `P` must not fire while focus is inside an input, textarea, select, or contenteditable element; Task 4 tests this.
- Missing PDFs and failed AI assistance must leave Eligibility usable for valid manual actions without allowing invalid inclusion; Task 5 tests this.

---

## File structure

- `frontend/src/features/articles/components/review/ReviewStageNavigator.jsx`: compact four-stage navigation and counts.
- `frontend/src/features/articles/components/review/AdaptiveReviewWorkspace.jsx`: responsive shell and mobile region switcher.
- `frontend/src/features/articles/components/review/ReviewQueuePanel.jsx`: existing queue/search/filter/pagination behavior extracted from `ProjectArticles.jsx`.
- `frontend/src/features/articles/components/review/ArticleReadingPane.jsx`: shared metadata, abstract, PDF state, and included-data summaries.
- `frontend/src/features/articles/components/review/IdentificationTool.jsx`: duplicate/source summary and identification actions.
- `frontend/src/features/articles/components/review/ScreeningDecisionTool.jsx`: inline Screening draft, shortcuts, validation, and submission.
- `frontend/src/features/articles/components/review/EligibilityDecisionTool.jsx`: inline checklist, evidence, RQs, AI draft, and submission.
- `frontend/src/features/articles/components/review/IncludedExtractionTool.jsx`: extraction progress and workspace action.
- `frontend/src/features/articles/components/ScreeningDecisionForm.jsx`: form shared by inline tool and existing modal.
- `frontend/src/features/articles/components/EligibilityDecisionForm.jsx`: form shared by inline tool and existing modal.
- `frontend/src/features/articles/components/ProjectArticles.jsx`: orchestration only; supplies data and callbacks to the workspace.
- `frontend/src/features/articles/hooks/useProjectArticles.js`: explicit article-id decision mutations and refresh behavior.

### Task 1: Shared navigator and responsive workspace shell

**Files:**
- Create: `frontend/src/features/articles/components/review/ReviewStageNavigator.jsx`
- Create: `frontend/src/features/articles/components/review/AdaptiveReviewWorkspace.jsx`
- Create: `frontend/src/features/articles/components/review/AdaptiveReviewWorkspace.test.jsx`
- Modify: `frontend/src/features/articles/components/ProjectArticles.jsx`

**Interfaces:**
- Produces: `ReviewStageNavigator({ activeStage, onStageChange, summary })`.
- Produces: `AdaptiveReviewWorkspace({ activeStage, queue, content, tool, hasDirtyDraft, onBeforeNavigate })`.
- `onBeforeNavigate(nextAction)` executes `nextAction` immediately when clean and asks for confirmation when `hasDirtyDraft` is true.

- [ ] **Step 1: Write failing shell tests**

  Assert that all four stages render with server summary counts, the active stage exposes `aria-current="step"`, desktop regions have accessible labels `Fila`, `Artigo`, and `Decisão`, and mobile region buttons select the visible region without unmounting their content.

- [ ] **Step 2: Run the shell test and verify failure**

  Run: `npm run test -- --run src/features/articles/components/review/AdaptiveReviewWorkspace.test.jsx`

  Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement the navigator and shell**

  Keep the shell presentation-only. Use CSS grid for wide screens, a collapsible queue region for compact screens, and three tab-like region buttons below the mobile breakpoint. Preserve mounted children so local form drafts survive region changes.

- [ ] **Step 4: Replace the old `StageStepper` wrapper in `ProjectArticles.jsx`**

  Render current panels through `AdaptiveReviewWorkspace` slots without changing their internals yet. Keep export/import actions in a compact page header.

- [ ] **Step 5: Run focused and existing ProjectArticles tests**

  Run: `npm run test -- --run src/features/articles/components/review/AdaptiveReviewWorkspace.test.jsx src/features/articles/components/ProjectArticles.test.jsx`

  Expected: PASS.

- [ ] **Step 6: Commit**

  ```bash
  git add frontend/src/features/articles/components/review frontend/src/features/articles/components/ProjectArticles.jsx
  git commit -m "feat: add adaptive review workspace shell"
  ```

### Task 2: Extract and adapt the shared review queue

**Files:**
- Create: `frontend/src/features/articles/components/review/ReviewQueuePanel.jsx`
- Create: `frontend/src/features/articles/components/review/ReviewQueuePanel.test.jsx`
- Modify: `frontend/src/features/articles/components/ProjectArticles.jsx`
- Modify: `frontend/src/features/articles/components/ProjectArticles.test.jsx`

**Interfaces:**
- Produces: `ReviewQueuePanel(props)` with the current `StageListPanel` data/callback contract plus `progressLabel` and `onRequestOpenQueue`.
- Consumes: existing `getArticleBadge`, filter definitions, pagination values, selection callbacks, and authorization flags moved with the component.

- [ ] **Step 1: Move the current queue assertions into a failing focused test**

  Cover the 1,093 server total, page 1 of 55, the selected article, Identification-only checkboxes, assigned-reviewer filters, and responsive metadata wrapping.

- [ ] **Step 2: Run the focused test and verify failure**

  Run: `npm run test -- --run src/features/articles/components/review/ReviewQueuePanel.test.jsx`

  Expected: FAIL because `ReviewQueuePanel` does not exist.

- [ ] **Step 3: Extract `StageListPanel` as `ReviewQueuePanel`**

  Preserve behavior and test ids. Replace the large stage description with a compact queue heading, progress, search, and filters. Keep bulk promotion controls exclusive to Identification.

- [ ] **Step 4: Integrate the queue into the workspace**

  Preserve search term, filter, page, and selected article when toggling responsive regions. Stage changes may reset stage-specific filters as they do today.

- [ ] **Step 5: Run queue and page tests**

  Run: `npm run test -- --run src/features/articles/components/review/ReviewQueuePanel.test.jsx src/features/articles/components/ProjectArticles.test.jsx`

  Expected: PASS.

- [ ] **Step 6: Commit**

  ```bash
  git add frontend/src/features/articles/components/review/ReviewQueuePanel.jsx frontend/src/features/articles/components/review/ReviewQueuePanel.test.jsx frontend/src/features/articles/components/ProjectArticles.jsx frontend/src/features/articles/components/ProjectArticles.test.jsx
  git commit -m "refactor: extract adaptive review queue"
  ```

### Task 3: Shared reading pane and non-decision stage tools

**Files:**
- Create: `frontend/src/features/articles/components/review/ArticleReadingPane.jsx`
- Create: `frontend/src/features/articles/components/review/IdentificationTool.jsx`
- Create: `frontend/src/features/articles/components/review/IncludedExtractionTool.jsx`
- Create: `frontend/src/features/articles/components/review/ReviewStageTools.test.jsx`
- Modify: `frontend/src/features/articles/components/ProjectArticles.jsx`

**Interfaces:**
- Produces: `ArticleReadingPane({ activeStage, article, project, position, onPrevious, onNext, onUploadPdf, onOpenArticle })`.
- Produces: `IdentificationTool({ articleTotal, duplicateCandidates, summary, canManageArticles, onRunDedup, onApplyDuplicateReview, onPromoteAllUnique, onExport })`.
- Produces: `IncludedExtractionTool({ article, project, summary, onOpenExtraction, onExport, onViewFlow })`.

- [ ] **Step 1: Write failing stage-tool tests**

  Assert that Identification exposes duplicate resolution and unique promotion, Inclusion reports `pendingExtraction` from the corpus summary rather than the loaded page, and the reading pane labels content as Resumo, Texto completo, or Dados do estudo exactly once.

- [ ] **Step 2: Run the test and verify failure**

  Run: `npm run test -- --run src/features/articles/components/review/ReviewStageTools.test.jsx`

  Expected: FAIL because the components do not exist.

- [ ] **Step 3: Extract the shared reading pane**

  Move metadata, article navigation, PDF state, and included-data preview from `ArticleDetailPanel`. Keep the comfortable text measure and remove nested decorative cards that do not communicate a distinct object.

- [ ] **Step 4: Implement Identification and Inclusion tools**

  Move the relevant `StageSidebar` actions and `DuplicateReviewPanel` entry points into contextual tools. Preserve the existing duplicate confirmation dialog and extraction navigation.

- [ ] **Step 5: Integrate both stages and run tests**

  Run: `npm run test -- --run src/features/articles/components/review/ReviewStageTools.test.jsx src/features/articles/components/ProjectArticles.test.jsx`

  Expected: PASS.

- [ ] **Step 6: Commit**

  ```bash
  git add frontend/src/features/articles/components/review frontend/src/features/articles/components/ProjectArticles.jsx
  git commit -m "feat: adapt identification and inclusion tools"
  ```

### Task 4: Inline Screening decision with shared form logic

**Files:**
- Create: `frontend/src/features/articles/components/ScreeningDecisionForm.jsx`
- Create: `frontend/src/features/articles/components/review/ScreeningDecisionTool.jsx`
- Create: `frontend/src/features/articles/components/review/ScreeningDecisionTool.test.jsx`
- Modify: `frontend/src/features/articles/components/ScreeningDecisionDialog.jsx`
- Modify: `frontend/src/features/articles/components/ScreeningDecisionDialog.test.jsx`
- Modify: `frontend/src/features/articles/hooks/useProjectArticles.js`
- Modify: `frontend/src/features/articles/hooks/useProjectArticles.test.jsx`
- Modify: `frontend/src/features/articles/components/ProjectArticles.jsx`

**Interfaces:**
- Produces: `ScreeningDecisionForm({ article, initialDecision, isSaving, canDecide, onDirtyChange, onSubmit })`.
- Produces: `ScreeningDecisionTool({ article, isSaving, onDirtyChange, onSubmit, onSkip })`.
- Changes hook mutation to `submitScreeningDecision(articleId, payload): Promise<boolean>`, returning `true` only after save and refresh succeed.

- [ ] **Step 1: Write failing inline Screening tests**

  Assert: exclusion requires a reason; inclusion allows an empty note; IA text can be copied but is labeled as a suggestion; submitted/conflict/unassigned articles disable decisions with the existing explanation; successful save calls `onSubmit(article.id, payload)` then `onAdvance`; failed save preserves inputs.

- [ ] **Step 2: Add failing shortcut tests**

  Assert that `I`, `E`, and `P` select Include, Exclude, and Skip when the panel owns focus, and do nothing for `input`, `textarea`, `select`, or `[contenteditable=true]` targets.

- [ ] **Step 3: Run the focused tests and verify failure**

  Run: `npm run test -- --run src/features/articles/components/review/ScreeningDecisionTool.test.jsx src/features/articles/components/ScreeningDecisionDialog.test.jsx src/features/articles/hooks/useProjectArticles.test.jsx`

  Expected: FAIL on missing shared form/tool and the old hook signature.

- [ ] **Step 4: Extract `ScreeningDecisionForm` and reuse it in the dialog**

  Keep Article Details behavior unchanged. The inline tool renders the same form without modal chrome and uses an explicit **Salvar e próximo** action.

- [ ] **Step 5: Update the hook mutation and integrate the inline tool**

  Use the explicit `articleId`; keep toast, refresh, assignment refresh, loading lock, and thrown-error behavior. Remove ProjectArticles-only modal target state after the inline path is active.

- [ ] **Step 6: Run focused tests**

  Run: `npm run test -- --run src/features/articles/components/review/ScreeningDecisionTool.test.jsx src/features/articles/components/ScreeningDecisionDialog.test.jsx src/features/articles/hooks/useProjectArticles.test.jsx src/features/articles/components/ProjectArticles.test.jsx`

  Expected: PASS.

- [ ] **Step 7: Commit**

  ```bash
  git add frontend/src/features/articles/components/ScreeningDecisionForm.jsx frontend/src/features/articles/components/review/ScreeningDecisionTool.jsx frontend/src/features/articles/components/review/ScreeningDecisionTool.test.jsx frontend/src/features/articles/components/ScreeningDecisionDialog.jsx frontend/src/features/articles/components/ScreeningDecisionDialog.test.jsx frontend/src/features/articles/hooks/useProjectArticles.js frontend/src/features/articles/hooks/useProjectArticles.test.jsx frontend/src/features/articles/components/ProjectArticles.jsx
  git commit -m "feat: add inline screening decisions"
  ```

### Task 5: Inline Eligibility checklist with shared form logic

**Files:**
- Create: `frontend/src/features/articles/components/EligibilityDecisionForm.jsx`
- Create: `frontend/src/features/articles/components/review/EligibilityDecisionTool.jsx`
- Create: `frontend/src/features/articles/components/review/EligibilityDecisionTool.test.jsx`
- Modify: `frontend/src/features/articles/components/EligibilityDecisionDialog.jsx`
- Modify: `frontend/src/features/articles/components/EligibilityDecisionDialog.test.jsx`
- Modify: `frontend/src/features/articles/hooks/useProjectArticles.js`
- Modify: `frontend/src/features/articles/hooks/useProjectArticles.test.jsx`
- Modify: `frontend/src/features/articles/components/ProjectArticles.jsx`

**Interfaces:**
- Produces: `EligibilityDecisionForm({ article, checklist, pdfData, projectId, researchQuestions, initialDecision, isSaving, canDecide, onDirtyChange, onSubmit })`.
- Produces: `EligibilityDecisionTool(props)` that wraps the shared form with contextual progress and article navigation.
- Changes hook mutation to `submitEligibilityDecision(articleId, payload): Promise<boolean>`.

- [ ] **Step 1: Write failing Eligibility tool tests**

  Assert: inclusion is blocked without PDF; exclusion and unavailable-text decisions require a reason; checklist statuses and evidence survive a rejected submit; RQs are submitted only for inclusion; AI results populate draft evidence but do not submit or silently select a final decision.

- [ ] **Step 2: Add failed-assistance coverage**

  Assert that AI extraction/network failure shows an inline explanation, retains manual checklist controls, and does not relax PDF or justification validation.

- [ ] **Step 3: Run focused tests and verify failure**

  Run: `npm run test -- --run src/features/articles/components/review/EligibilityDecisionTool.test.jsx src/features/articles/components/EligibilityDecisionDialog.test.jsx src/features/articles/hooks/useProjectArticles.test.jsx`

  Expected: FAIL on missing shared form/tool and old hook signature.

- [ ] **Step 4: Extract `EligibilityDecisionForm` and reuse it in the dialog**

  Move parsing, checklist summaries, AI assistance, RQ selection, and validation without changing the Article Details modal behavior.

- [ ] **Step 5: Implement the wider inline Eligibility tool**

  Put PDF/full-text status in the reading region and checklist/evidence/decision in the contextual region. Label AI-filled content as draft and keep the human save action separate.

- [ ] **Step 6: Update the hook mutation and integrate the tool**

  Preserve graph refresh, synthesis refresh, assignment refresh, loading lock, toast, and thrown-error behavior.

- [ ] **Step 7: Run focused tests**

  Run: `npm run test -- --run src/features/articles/components/review/EligibilityDecisionTool.test.jsx src/features/articles/components/EligibilityDecisionDialog.test.jsx src/features/articles/hooks/useProjectArticles.test.jsx src/features/articles/components/ProjectArticles.test.jsx`

  Expected: PASS.

- [ ] **Step 8: Commit**

  ```bash
  git add frontend/src/features/articles/components/EligibilityDecisionForm.jsx frontend/src/features/articles/components/review/EligibilityDecisionTool.jsx frontend/src/features/articles/components/review/EligibilityDecisionTool.test.jsx frontend/src/features/articles/components/EligibilityDecisionDialog.jsx frontend/src/features/articles/components/EligibilityDecisionDialog.test.jsx frontend/src/features/articles/hooks/useProjectArticles.js frontend/src/features/articles/hooks/useProjectArticles.test.jsx frontend/src/features/articles/components/ProjectArticles.jsx
  git commit -m "feat: add inline eligibility decisions"
  ```

### Task 6: Dirty-draft protection, accessibility, and responsive integration

**Files:**
- Create: `frontend/src/features/articles/components/review/useReviewDraftGuard.js`
- Create: `frontend/src/features/articles/components/review/useReviewDraftGuard.test.js`
- Modify: `frontend/src/features/articles/components/review/AdaptiveReviewWorkspace.jsx`
- Modify: `frontend/src/features/articles/components/review/AdaptiveReviewWorkspace.test.jsx`
- Modify: `frontend/src/features/articles/components/ProjectArticles.jsx`
- Modify: `frontend/e2e/review-flow-audit.spec.js`

**Interfaces:**
- Produces: `useReviewDraftGuard({ isDirty, confirmDiscard })` returning `{ guard(action), isConfirmOpen, confirm, cancel }`.
- Consumes: `onDirtyChange` from Screening and Eligibility tools.

- [ ] **Step 1: Write failing draft-guard tests**

  Assert that clean navigation runs immediately; dirty article/stage navigation opens confirmation; cancel preserves the draft and selection; confirm discards and runs the pending action exactly once.

- [ ] **Step 2: Add accessibility and responsive shell assertions**

  Assert logical focus order, visible focus classes, live status for save/error/automatic advance, color-independent labels, and mounted state across mobile region changes.

- [ ] **Step 3: Run focused tests and verify failure**

  Run: `npm run test -- --run src/features/articles/components/review/useReviewDraftGuard.test.js src/features/articles/components/review/AdaptiveReviewWorkspace.test.jsx`

  Expected: FAIL because the guard and final accessibility behavior do not exist.

- [ ] **Step 4: Implement the guard and connect all navigation entry points**

  Guard queue selection, previous/next, stage changes, filters that replace the selected article, and page changes. Do not guard mobile region toggles because they preserve mounted form state.

- [ ] **Step 5: Update the E2E review flow**

  Add scenarios for the four-stage shell, Screening save-and-next, Eligibility validation, responsive region switching, keyboard-only decision flow, and dirty-draft cancellation.

- [ ] **Step 6: Run the complete frontend verification**

  Run: `npm run test:ci`

  Expected: all unit tests PASS.

  Run: `npm run lint`

  Expected: exit code 0.

  Run: `npm run build`

  Expected: production build succeeds.

  Run: `npm run test:e2e -- --grep "review"`

  Expected: review-flow scenarios PASS with the configured test environment.

- [ ] **Step 7: Commit**

  ```bash
  git add frontend/src/features/articles/components/review frontend/src/features/articles/components/ProjectArticles.jsx frontend/e2e/review-flow-audit.spec.js
  git commit -m "feat: complete adaptive review workflow"
  ```

### Task 7: Visual verification and cleanup

**Files:**
- Modify only files from Tasks 1-6 when the rendered comparison reveals a mismatch.

**Interfaces:**
- Consumes: completed adaptive workspace and the approved composition in `.superpowers/brainstorm/`.
- Produces: verified desktop, compact desktop/tablet, and mobile layouts with no new behavior.

- [ ] **Step 1: Capture the four stages at representative viewports**

  Use desktop `1440×1024`, compact desktop/tablet `1024×768`, and mobile `390×844`. Capture Identification, Screening, Eligibility, and Inclusion with realistic data.

- [ ] **Step 2: Compare against the approved design**

  Check stable region placement, hierarchy, reading width, panel density, clipped content, focus states, contrast, borders, radii, and spacing. Record concrete mismatches before editing.

- [ ] **Step 3: Fix only observed mismatches**

  Keep design-system tokens and existing components; do not introduce new features during polish.

- [ ] **Step 4: Re-run verification after visual fixes**

  Run: `npm run test:ci && npm run lint && npm run build`

  Expected: all commands succeed.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend
  git commit -m "fix: polish adaptive review workspace"
  ```
