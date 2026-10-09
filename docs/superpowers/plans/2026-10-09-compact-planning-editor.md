# Compact Planning Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the long planning-card dashboard with the approved compact tabbed and expandable editor while preserving every planning capability and draft.

**Architecture:** Keep `useProjectPlanning` as the form and request boundary. Add a small metadata utility for stable section grouping/completion, focused presentation components for header/tabs/accordions/search, and let `ProjectPlanning` compose the existing domain editors inside that shell.

**Tech Stack:** React 19, JavaScript, Tailwind CSS, Radix-based UI components, Vitest, Testing Library, Vite.

**Spec:** `docs/superpowers/specs/2026-10-09-compact-planning-editor-design.md`

## Global Constraints

- No backend, database, service-contract, or planning-payload changes.
- Preserve generation, manual editing, export, save, discard, dirty-state guard, and loading behavior.
- Use one information architecture at desktop, tablet, and 390 px; no wizard or alternate mobile route.
- Tab changes and accordion changes must never reset unsaved form state.
- Completion must be communicated through text and color.
- No new product dependencies.

## Review Focus

- A partially completed framework must keep `Fundação` active and open the framework section; Task 1 pins the completion and first-incomplete calculation.
- Empty arrays and missing optional project properties must produce zero summaries without throwing; Task 1 covers sparse data.
- Searching with accents or common aliases such as `PICOC`, `qualidade`, or `triagem` must reach the intended section; Task 2 covers normalized keyword matching.
- Switching tabs after typing into a field must preserve its live value; Task 3 covers retained drafts across visibility changes.
- At 390 px, long action labels and section summaries must wrap without document-level horizontal overflow; Task 4 covers responsive containment and browser QA.

---

### Task 1: Planning section metadata and completion model

**Files:**
- Create: `frontend/src/features/projects/utils/planningSections.js`
- Create: `frontend/src/features/projects/utils/planningSections.test.js`

**Interfaces:**
- Consumes: planning `data`, `framework`, and `frameworkComponents` from `useProjectPlanning`.
- Produces: `PLANNING_TABS`, `getPlanningSectionState({ data, framework, frameworkComponents })`, and `findFirstIncompleteSection(sections)` for Tasks 2–3.

- [ ] **Step 1: Write failing metadata tests**

Test that the utility returns the exact tab keys `foundation`, `selection`, `data`; seven section keys; the spec's completion predicates; stable zero-count summaries for sparse input; per-tab completed/total counts; and framework as the first incomplete section when a required framework component is blank.

- [ ] **Step 2: Run the utility test and verify RED**

Run: `npm --prefix frontend test -- --run src/features/projects/utils/planningSections.test.js --reporter=dot`

Expected: FAIL because `planningSections.js` does not exist.

- [ ] **Step 3: Implement the metadata utility**

Implement pure functions only. Each returned section has `{ key, tab, label, description, keywords, complete, summary }`; no React nodes or callbacks belong in the utility.

- [ ] **Step 4: Run the utility test and verify GREEN**

Run: `npm --prefix frontend test -- --run src/features/projects/utils/planningSections.test.js --reporter=dot`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/projects/utils/planningSections.js frontend/src/features/projects/utils/planningSections.test.js
git commit -m "feat: model compact planning sections"
```

---

### Task 2: Compact planning shell components

**Files:**
- Create: `frontend/src/features/projects/components/planning/PlanningEditorHeader.jsx`
- Create: `frontend/src/features/projects/components/planning/PlanningTabs.jsx`
- Create: `frontend/src/features/projects/components/planning/PlanningAccordionSection.jsx`
- Create: `frontend/src/features/projects/components/planning/PlanningSectionSearch.jsx`
- Create: `frontend/src/features/projects/components/planning/PlanningShell.test.jsx`

**Interfaces:**
- Consumes: section records and `PLANNING_TABS` from Task 1.
- Produces: controlled components with `activeTab/onTabChange`, `expanded/onExpandedChange`, and `onSectionSelect(sectionKey)` interfaces for Task 3.

- [ ] **Step 1: Write failing shell tests**

Assert accessible tab/panel relationships and keyboard-ready roles; visible per-tab completion text; independent `aria-expanded` accordion state; header progress text and linear indicator; and search that normalizes case/accents, matches labels/keywords, then calls `onSectionSelect` with the chosen key.

- [ ] **Step 2: Run shell tests and verify RED**

Run: `npm --prefix frontend test -- --run src/features/projects/components/planning/PlanningShell.test.jsx --reporter=dot`

Expected: FAIL because the shell components do not exist.

- [ ] **Step 3: Implement `PlanningEditorHeader` and `PlanningTabs`**

Use the approved copy `Configurar protocolo`, `Fundação`, `Seleção`, and `Dados`. Keep export and search as controlled callbacks and expose progress with `aria-valuenow`, `aria-valuemin="0"`, and `aria-valuemax="100"`.

- [ ] **Step 4: Implement `PlanningAccordionSection` and `PlanningSectionSearch`**

The accordion is controlled and keeps children mounted while toggling their visibility so local input drafts survive collapse; expansion is independent per section. Search filters static section metadata, uses existing dialog primitives, and returns selection to the parent without owning tab state.

- [ ] **Step 5: Run shell tests and verify GREEN**

Run: `npm --prefix frontend test -- --run src/features/projects/components/planning/PlanningShell.test.jsx --reporter=dot`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/projects/components/planning
git commit -m "feat: add compact planning shell"
```

---

### Task 3: Recompose ProjectPlanning and inline criteria

**Files:**
- Modify: `frontend/src/features/projects/components/ProjectPlanning.jsx`
- Modify: `frontend/src/features/projects/components/ProjectPlanning.test.jsx`

**Interfaces:**
- Consumes: Task 1 metadata and Task 2 controlled shell components.
- Produces: the complete compact editor with all existing field and action callbacks still sourced from `useProjectPlanning`.

- [ ] **Step 1: Write failing composition tests**

Assert the initial tab contains the first incomplete section; selecting each tab shows the correct section group; multiple sections can remain expanded; the old bottom `Resumo do planejamento` is absent; export remains present; and all seven section names are reachable through tabs/search.

- [ ] **Step 2: Write the failing draft-retention and criteria tests**

Use a stateful hook mock to type into a framework field, change tabs twice, and assert the typed value remains. Expand criteria and assert inclusion, exclusion, and eligibility checklist inputs are editable inline without opening a dialog.

- [ ] **Step 3: Run ProjectPlanning tests and verify RED**

Run: `npm --prefix frontend test -- --run src/features/projects/components/ProjectPlanning.test.jsx --reporter=dot`

Expected: FAIL because the current page is a card dashboard and criteria editor is modal-only.

- [ ] **Step 4: Add presentation state and compose the shell**

Initialize `activeTab` and `expandedSectionKeys` from `findFirstIncompleteSection`. Keep expansion state in a `Set`; tab edits never replace planning data. Section search selects the owning tab, expands the target, closes, then focuses the section heading.

- [ ] **Step 5: Move existing editors into the seven accordion sections**

Reuse `ResearchQuestionsEditor`, `SearchStringsEditor`, framework fields, extraction fields, quality fields, and generation actions. Render the three existing `ArrayEditor` instances directly inside the criteria accordion and remove the criteria dialog state/markup.

- [ ] **Step 6: Preserve save, discard, errors, loading, and bottom clearance**

Keep the current sticky dirty bar and callbacks. Add bottom padding while dirty so the last editor remains reachable. Do not change hook signatures or service calls.

- [ ] **Step 7: Run focused planning tests and verify GREEN**

Run: `npm --prefix frontend test -- --run src/features/projects/components/ProjectPlanning.test.jsx src/features/projects/hooks/useProjectPlanning.test.jsx --reporter=dot`

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/projects/components/ProjectPlanning.jsx frontend/src/features/projects/components/ProjectPlanning.test.jsx
git commit -m "feat: recompose planning as compact editor"
```

---

### Task 4: Responsive polish and verification

**Files:**
- Modify: `frontend/src/features/projects/components/ProjectPlanning.jsx`
- Modify: `frontend/src/features/projects/components/ProjectPlanning.test.jsx`
- Modify: `frontend/src/features/projects/components/planning/PlanningEditorHeader.jsx`
- Modify: `frontend/src/features/projects/components/planning/PlanningTabs.jsx`
- Modify: `design-qa.md`

**Interfaces:**
- Consumes: completed compact editor from Task 3.
- Produces: 390 px containment, final regression evidence, and visual QA record.

- [ ] **Step 1: Write failing responsive assertions**

Assert header actions use wrapping/min-width containment, tabs fit three columns without a minimum fixed width, accordion headings/actions wrap, and the dirty bar leaves bottom spacing in the editor while visible.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm --prefix frontend test -- --run src/features/projects/components/ProjectPlanning.test.jsx src/features/projects/components/planning/PlanningShell.test.jsx --reporter=dot`

Expected: FAIL until responsive classes are present.

- [ ] **Step 3: Implement responsive containment**

Use `min-w-0`, wrapping action groups, three equal tab columns, and mobile-stacked header/save controls. Preserve the same tab and accordion structure at every breakpoint.

- [ ] **Step 4: Run full automated verification**

Run: `npm --prefix frontend run test:ci`

Expected: Node tests and all Vitest files pass.

Run: `npm --prefix frontend run lint`

Expected: exit 0 with no errors or warnings introduced by this work.

Run: `npm --prefix frontend run build`

Expected: exit 0 and a successful Vite production build.

- [ ] **Step 5: Run browser visual QA**

Capture the authenticated/mock planning page at 1440 px and 390 px. Exercise each tab, at least two simultaneously expanded sections, section search, criteria inline editing, and the dirty bar. Confirm document width equals viewport width and collect console/page/network errors. Append evidence and `final result: passed` or an external blocker to `design-qa.md`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/projects/components frontend/src/features/projects/utils design-qa.md
git commit -m "test: verify compact planning editor"
```
