# UI Consistency, Library, and Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the Synapse application shell, redesign the article library, and make project planning edits obvious and safe before production.

**Architecture:** Keep the existing React routing and feature boundaries, but make `AppHeader` and `Layout` the shared geometry contract. Add dirty-state ownership to `useProjectPlanning`, route all project-tab changes through a guarded callback, and restyle list pages with existing UI primitives instead of adding a new design system.

**Tech Stack:** React 19, React Router 7, Tailwind CSS 4, Radix UI, Vitest, Testing Library, Playwright.

**Spec:** `docs/plans/2026-10-07-ui-consistency-library-planning-design.md`

## Global Constraints

- Preserve all unrelated backend changes, untracked datasets, and previously generated audit screenshots.
- Use 72 px desktop headers, 20 px small-screen horizontal padding, and 40 px desktop horizontal padding.
- Keep excluded articles available through the Library status filter after removing the Trash navigation item.
- Keep Planning saves manual; do not introduce autosave.
- User-visible interface copy touched by this plan must use correct Brazilian Portuguese.
- Use semantic interactive elements with pointer, hover, keyboard focus, disabled states, and accessible names.

## Review Focus

- A Planning save failure must retain edited data and the dirty-state bar; Task 3 tests this explicitly.
- Canceling a pending-navigation confirmation must preserve both the current tab and the form data; Task 4 tests this explicitly.
- A project refresh that returns equivalent data must not create a false dirty state; Task 3 tests normalized snapshot comparison.
- Empty or single-page Library results must keep a stable footer and disabled pagination controls; Task 2 tests both conditions.
- Compact and regular `AppHeader` variants must render account controls and align to the same horizontal grid; Task 5 tests both variants.

---

### Task 1: Shared interaction affordances and navigation cleanup

**Files:**
- Modify: `frontend/src/components/ui/Button.jsx`
- Modify: `frontend/src/components/ui/select.jsx`
- Modify: `frontend/src/components/ui/DropdownMenu.jsx`
- Modify: `frontend/src/components/Menu.jsx`
- Create: `frontend/src/components/Menu.test.jsx`

**Interfaces:**
- Consumes: existing `Button`, Radix Select, Radix Dropdown Menu, and `NAV_ITEMS` rendering.
- Produces: shared pointer/disabled/focus behavior and a sidebar without the redundant Trash route.

- [ ] **Step 1: Write failing component tests**

Add tests named `does not expose a redundant trash destination` and `marks enabled navigation actions as interactive`, asserting that “Lixeira” is absent and enabled links/buttons expose the shared interactive classes while disabled controls remain unavailable.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npm run test:ci -- src/components/Menu.test.jsx`

Expected: FAIL because the Trash item is still rendered and shared primitives do not yet expose the required pointer behavior.

- [ ] **Step 3: Implement shared affordances and remove Trash**

Add `cursor-pointer` and focus-visible styling to enabled button/select/dropdown primitives, preserve `disabled:cursor-not-allowed`, add pointer styling to sidebar links, and remove the Trash icon/import/navigation item.

- [ ] **Step 4: Run focused tests**

Run: `npm run test:ci -- src/components/Menu.test.jsx`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `fix: clarify interactive navigation controls`

### Task 2: Align Projects and redesign the Library list

**Files:**
- Modify: `frontend/src/pages/Projects.jsx`
- Create: `frontend/src/pages/Projects.test.jsx`
- Modify: `frontend/src/pages/Articles.jsx`
- Modify: `frontend/src/pages/Articles.test.jsx`

**Interfaces:**
- Consumes: shared `Select` primitives from Task 1 and `useArticlesLibraryPage` pagination contract.
- Produces: Projects sorting through `Select` and a Library page with Projects-style hierarchy, direct list rows/cards, and stable pagination.

- [ ] **Step 1: Write failing page tests**

In `Projects.test.jsx`, add `sorts projects through the shared select` and assert the title option orders visible project rows. In `Articles.test.jsx`, add `renders the library hierarchy without an enclosing list card`, `keeps excluded articles reachable from the status filter`, and `disables pagination for empty and single-page results`.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npm run test:ci -- src/pages/Projects.test.jsx src/pages/Articles.test.jsx`

Expected: FAIL on the native Projects select and old Library container/hierarchy.

- [ ] **Step 3: Replace the Projects sorting control**

Use `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, and `SelectItem` with values `recent`, `oldest`, and `title`, preserving the existing `sortOrder` state and sorting logic.

- [ ] **Step 4: Restructure `ArticleLibraryList` and page heading**

Render a Projects-style `h1`/subtitle, independent filter bar, direct responsive list surface without the viewport-height outer card, and an attached non-floating pagination footer. Preserve `ArticleLibraryList({ articles, loading, onOpenArticle, onPageChange, page, pageSize, total })`.

- [ ] **Step 5: Correct visible Portuguese copy in both pages**

Correct status labels, headings, dates, empty states, accessible labels, and corrupted characters without translating source article metadata.

- [ ] **Step 6: Run focused tests**

Run: `npm run test:ci -- src/pages/Projects.test.jsx src/pages/Articles.test.jsx`

Expected: PASS.

- [ ] **Step 7: Commit**

Commit: `feat: align project and library listings`

### Task 3: Add explicit Planning dirty state and sticky save bar

**Files:**
- Modify: `frontend/src/features/projects/hooks/useProjectPlanning.js`
- Create: `frontend/src/features/projects/hooks/useProjectPlanning.test.jsx`
- Modify: `frontend/src/features/projects/components/ProjectPlanning.jsx`
- Create: `frontend/src/features/projects/components/ProjectPlanning.test.jsx`
- Modify: `frontend/src/features/projects/components/PlanningArrayField.jsx`
- Modify: `frontend/src/features/projects/components/PlanningFrameworkFields.jsx`

**Interfaces:**
- Consumes: `projectService.updateProject(projectId, payload)` and current Planning field mutations.
- Produces: hook properties `isDirty: boolean` and `discardChanges(): void`; `ProjectPlanning` callback `onDirtyChange?(isDirty: boolean)`; sticky save/discard bar.

- [ ] **Step 1: Write failing hook tests**

Add `becomes dirty after a field change`, `stays clean for an equivalent project refresh`, `clears dirty state after a successful save`, `keeps edits dirty after a failed save`, and `restores the last saved snapshot when discarded`.

- [ ] **Step 2: Run hook tests and verify failure**

Run: `npm run test:ci -- src/features/projects/hooks/useProjectPlanning.test.jsx`

Expected: FAIL because `isDirty` and `discardChanges` do not exist.

- [ ] **Step 3: Implement normalized snapshot tracking**

Maintain a `savedDataRef` containing `buildInitialData(...)`, compare it to current data with a stable normalized serialization, expose `isDirty`, reset the reference after successful save/project reload, and expose `discardChanges()` to restore it.

- [ ] **Step 4: Run hook tests**

Run: `npm run test:ci -- src/features/projects/hooks/useProjectPlanning.test.jsx`

Expected: PASS.

- [ ] **Step 5: Write failing Planning component tests**

Add `shows a sticky unsaved changes bar only when dirty`, `discards local changes`, `keeps the save action visible after a failed request`, and `keeps edit actions visible for list fields`.

- [ ] **Step 6: Run component tests and verify failure**

Run: `npm run test:ci -- src/features/projects/components/ProjectPlanning.test.jsx`

Expected: FAIL because the sticky bar and consistent visible edit controls do not exist.

- [ ] **Step 7: Implement Planning affordances and save bar**

Render editable fields with consistent border/background/focus styling, keep array edit/remove actions visible, remove the redundant top-only save dependency, and add a sticky bar with “Alterações não salvas”, `Descartar`, and `Salvar alterações`. Notify `onDirtyChange` whenever `isDirty` changes.

- [ ] **Step 8: Correct Planning copy**

Correct all visible accents and mojibake in `ProjectPlanning.jsx`, `PlanningArrayField.jsx`, and `PlanningFrameworkFields.jsx`.

- [ ] **Step 9: Run focused tests**

Run: `npm run test:ci -- src/features/projects/hooks/useProjectPlanning.test.jsx src/features/projects/components/ProjectPlanning.test.jsx`

Expected: PASS.

- [ ] **Step 10: Commit**

Commit: `feat: protect unsaved planning changes`

### Task 4: Guard project tab and browser navigation

**Files:**
- Modify: `frontend/src/pages/ProjectDetails.jsx`
- Modify: `frontend/src/features/projects/components/ProjectDetailsHeader.jsx`
- Modify: `frontend/src/features/projects/components/ProjectDetailsHeader.test.jsx`
- Modify: `frontend/src/features/projects/hooks/useProjectDetailsPage.test.jsx`

**Interfaces:**
- Consumes: `ProjectPlanning onDirtyChange` from Task 3 and existing `ConfirmationDialog`.
- Produces: guarded project-tab callback that commits a pending tab only after confirmation; `beforeunload` protection while Planning is dirty.

- [ ] **Step 1: Write failing navigation tests**

Add `asks before leaving dirty Planning`, `cancel keeps the Planning tab and edits`, `confirm opens the requested tab`, and `registers beforeunload only while dirty`.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm run test:ci -- src/features/projects/components/ProjectDetailsHeader.test.jsx src/features/projects/hooks/useProjectDetailsPage.test.jsx`

Expected: FAIL because tab changes navigate immediately.

- [ ] **Step 3: Implement guarded tab changes**

Track `planningDirty`, `pendingTab`, and confirmation visibility in `ProjectDetails`; route `ProjectDetailsHeader` tab clicks through `requestTabChange(nextTab)`, and complete `setActiveTab(pendingTab)` only after confirmation.

- [ ] **Step 4: Add browser-exit protection**

Register and clean up a `beforeunload` handler while `planningDirty` is true. Do not block normal navigation once saving or discarding clears the dirty state.

- [ ] **Step 5: Run focused tests**

Run: `npm run test:ci -- src/features/projects/components/ProjectDetailsHeader.test.jsx src/features/projects/hooks/useProjectDetailsPage.test.jsx`

Expected: PASS.

- [ ] **Step 6: Commit**

Commit: `feat: guard navigation with planning edits`

### Task 5: Unify the general and detailed workspace shell

**Files:**
- Modify: `frontend/src/components/layout/AppHeader.jsx`
- Modify: `frontend/src/components/layout/AppHeader.test.jsx`
- Modify: `frontend/src/pages/Layout.jsx`
- Modify: `frontend/src/pages/ArticleDetails.jsx`
- Modify: `frontend/src/pages/ArticleDetails.test.jsx`
- Modify: `frontend/src/features/projects/components/ProjectDetailsHeader.jsx`

**Interfaces:**
- Consumes: current `AppHeader({ actions, backUrl, breadcrumbs, compact, title })` props and authentication account menu.
- Produces: one 72 px header geometry with account controls in both variants and a shared `app-content-padding` layout contract used by pages and workspaces.

- [ ] **Step 1: Write failing shell tests**

Add `keeps account controls in compact mode`, `uses the same horizontal grid in compact and regular modes`, and Article Details assertions that review/extraction breadcrumbs and account controls remain visible.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm run test:ci -- src/components/layout/AppHeader.test.jsx src/pages/ArticleDetails.test.jsx`

Expected: FAIL on compact geometry/account consistency.

- [ ] **Step 3: Normalize `AppHeader` and `Layout` geometry**

Use one 72 px height and the 20/40 px horizontal padding contract. Preserve the compact prop only for content density, not account visibility or alignment. Add pointer/focus behavior to breadcrumb links and back controls.

- [ ] **Step 4: Apply the shell contract to review and extraction**

Remove workspace-only offsets that conflict with the global header, keep specialized side panels below the shell, and align page titles, breadcrumbs, and content with general pages. Correct visible Portuguese copy in touched workspace sections.

- [ ] **Step 5: Run focused tests**

Run: `npm run test:ci -- src/components/layout/AppHeader.test.jsx src/pages/ArticleDetails.test.jsx src/features/projects/components/ProjectDetailsHeader.test.jsx`

Expected: PASS.

- [ ] **Step 6: Commit**

Commit: `refactor: unify application workspace shell`

### Task 6: Full regression and Playwright visual-flow audit

**Files:**
- Modify: `frontend/e2e/product-audit.spec.js`
- Modify: `frontend/e2e/library-pagination-audit.spec.js`
- Create: `frontend/e2e/planning-navigation-audit.spec.js`
- Create: `docs/audits/playwright-ui-consistency-2026-10-07/` screenshots generated by Playwright.

**Interfaces:**
- Consumes: completed behavior from Tasks 1–5 and the existing authenticated Playwright setup.
- Produces: executable regression coverage and current-run visual evidence.

- [ ] **Step 1: Extend Playwright assertions before implementation-specific fixes**

Cover Projects shared sorting, Library filtering/pagination, absence of Trash, dirty Planning confirmation/cancel/save, and account/breadcrumb consistency in overview, review, and extraction.

- [ ] **Step 2: Run the new Playwright spec and fix only observed integration gaps**

Run: `npx playwright test e2e/planning-navigation-audit.spec.js --project=chromium`

Expected: PASS with current-run screenshots written to `docs/audits/playwright-ui-consistency-2026-10-07/`.

- [ ] **Step 3: Run the complete frontend verification**

Run: `npm run test:ci`

Expected: all unit/component tests pass.

Run: `npm run lint`

Expected: zero lint errors.

Run: `npm run build`

Expected: production build succeeds.

Run: `npm run test:e2e`

Expected: all applicable Playwright tests pass; environment-dependent skips remain documented.

- [ ] **Step 4: Inspect every new screenshot**

Verify desktop and mobile alignment, no clipping/overflow, visible save state, consistent breadcrumbs/avatar, correct Library density, and Portuguese copy. Iterate and rerun affected tests for any visual defect.

- [ ] **Step 5: Check the final diff scope**

Run: `git status --short` and `git diff --check`.

Expected: no unrelated backend/data/audit files staged and no whitespace errors in plan-owned files.

- [ ] **Step 6: Commit**

Commit: `test: cover ui consistency workflows`
