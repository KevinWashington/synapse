# Compact Planning Editor — Design Specification

Date: 2026-10-09
Status: approved design

## Intent

Redesign the project planning page as a compact editor that supports fast editing while sharing the visual grammar of the unified review workspace. The page must stop reading as a long dashboard of unrelated cards and instead expose a stable header, thematic tabs, and expandable editing sections.

The redesign is presentation-only. It preserves the existing planning data model, generation actions, save/discard behavior, service contracts, dirty-state guard, and export behavior.

## Success criteria

- A user can reach any planning section with at most one tab change and one section expansion.
- Switching tabs or expanding sections never loses unsaved values.
- Desktop and mobile use the same information architecture.
- Planning feels visually related to the review workspace without copying its queue/decision semantics.
- Progress and unsaved-state actions remain visible without requiring a scroll to the bottom.
- Existing AI generation, manual editing, export, save, and discard capabilities remain available.

## Information architecture

The editor has three thematic tabs.

### Foundation (`Fundação`)

- Structured research framework (PICOC, PICO, SPIDER, or the project-selected framework).
- Research questions.

### Selection (`Seleção`)

- Search strategy and target database.
- Inclusion criteria, exclusion criteria, and eligibility checklist.
- Screening guidance.

### Data (`Dados`)

- Data extraction schema.
- Quality assessment criteria.

This grouping is fixed and does not change based on completion. Completion changes status indicators only.

## Page composition

### Compact header

The planning content begins with a compact editor header containing:

- title `Configurar protocolo`;
- a short completion summary (`4 de 7 seções completas`);
- a linear completion indicator and percentage;
- section search trigger;
- `Exportar planejamento` as a secondary action.

The header replaces the large summary card currently rendered after all editors. No duplicate completion summary remains at the bottom.

### Thematic tabs

Tabs `Fundação`, `Seleção`, and `Dados` sit directly below the header. Each tab displays a small completion count for its own group. Tabs use proper `tablist`, `tab`, and `tabpanel` semantics and support keyboard navigation.

Changing the active tab only changes visibility. Section components remain owned by the same planning form state, so draft values survive tab changes.

### Expandable sections

Each tab contains compact accordion sections. A section header includes:

- section title and concise description;
- completion status (`Completa`, `Em andamento`, or `Não iniciada`);
- a data summary such as number of questions, criteria, strings, or fields;
- expand/collapse control.

Users may keep multiple sections open. The first incomplete section in the active tab opens by default; when every section is complete, the first section opens. Expanding one section does not collapse another.

The section body contains the existing editor and its contextual actions. AI generation buttons remain local to the section they affect.

### Section search

The search trigger opens a lightweight command-style dialog listing all planning sections. Typing filters by section name and common keywords. Selecting a result switches to the correct tab, expands the section, closes the dialog, and moves focus to the section heading.

Search does not inspect or filter user-entered field values.

### Unsaved changes bar

The existing sticky unsaved-changes bar remains at the bottom of the viewport and appears only while the form is dirty. It contains `Descartar` and `Salvar alterações` and does not obscure the last editor; the content receives sufficient bottom spacing while the bar is present.

## Responsive behavior

Desktop, tablet, and mobile retain the same header, three tabs, and accordion model.

- On desktop, content uses the available project page width with a readable central measure.
- On tablet, tab labels remain visible and actions may wrap within the header.
- On mobile, the header stacks, tabs remain horizontally contained, and section actions wrap below their title when needed.
- No separate wizard, mobile-only route, or alternate information architecture is introduced.
- Controls must not cause document-level horizontal scrolling at 390 px.

## Component boundaries

`ProjectPlanning` continues to own orchestration through `useProjectPlanning` and composes focused presentation components:

- `PlanningEditorHeader`: title, progress, search trigger, and export.
- `PlanningTabs`: accessible thematic navigation and group completion.
- `PlanningAccordionSection`: reusable section shell with status and expansion.
- `PlanningSectionSearch`: command-style dialog and section navigation.
- Existing field editors remain responsible for their current inputs.

Section metadata lives in one configuration structure containing key, tab, label, description, completion predicate, summary, and render content. The same structure drives tabs, accordions, completion totals, and search results to prevent labels or grouping from drifting apart.

Large domain-specific editors remain separate from the generic accordion shell. The redesign must not move API orchestration into presentation components.

## State and data flow

`useProjectPlanning` remains the source of truth for planning values, loading flags, dirty state, generation actions, save, and discard.

`ProjectPlanning` adds only presentation state:

- active tab key;
- set of expanded section keys;
- search dialog visibility and query.

The initial tab is the group containing the first incomplete section. If all sections are complete, the initial tab is `Fundação`. Subsequent edits do not forcibly move the active tab or collapse sections.

Save and discard retain their existing payload and service behavior. Successful save updates the project through the existing callback and clears dirty state. Failed save preserves all draft values and leaves the relevant sections open.

Generation actions update the same hook state. While an action runs, only its existing action control is disabled and shows loading; navigation among tabs and sections remains available.

## Completion model

Completion uses the existing domain checks, reorganized into seven visible sections:

1. framework required fields complete;
2. at least one research question;
3. at least one search string;
4. at least one inclusion or exclusion criterion;
5. screening guidance present;
6. at least one extraction field;
7. at least one quality criterion.

The eligibility checklist contributes to the criteria section summary but is not a separate progress item. Empty optional supporting notes do not block overall completion.

## Error and empty states

- A failed AI generation action keeps current user data and reports the existing error feedback.
- A failed save keeps the editor dirty and all drafts intact.
- Empty sections show their existing purposeful empty state and the relevant add/generate action.
- The criteria editor remains available inline within its accordion section; it no longer requires a separate large modal for normal editing.
- Destructive removal actions keep their current immediate behavior and remain recoverable through `Descartar` until saved.

## Accessibility

- Tabs and panels use correct ARIA relationships and keyboard behavior.
- Accordion triggers expose `aria-expanded` and `aria-controls`.
- Search results are keyboard reachable; selecting one restores focus to the opened section heading.
- Completion is communicated by text as well as color.
- Sticky actions do not cover focused controls.
- Existing visible labels and input accessible names are preserved.

## Testing strategy

Component tests must cover:

- section-to-tab grouping and completion counts;
- initial tab and first-incomplete-section behavior;
- tab changes preserving edited values;
- independent multi-section expansion;
- section search opening the correct tab and section;
- save/discard bar behavior and failure preservation;
- criteria editing inline rather than only through a modal;
- responsive containment classes and accessible tab/accordion semantics;
- retention of all current generation, export, save, and field-editing capabilities.

The full frontend suite, lint, production build, and browser visual QA at desktop and 390 px are required before completion.

## Out of scope

- Backend or database changes.
- Changes to planning generation prompts or AI results.
- A sequential setup wizard.
- Autosave.
- Collaboration or concurrent editing.
- Changes to the review workspace.
