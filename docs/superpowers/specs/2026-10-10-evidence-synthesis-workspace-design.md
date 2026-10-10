# Evidence Synthesis Workspace — Design Specification

Date: 2026-10-10
Status: approved design

## Intent

Redesign the project synthesis area so its purpose is immediately clear: turn included studies into traceable answers to the review's research questions. The experience must connect research questions, extracted data, visual patterns, and methodological quality instead of presenting four disconnected reports.

The redesign follows the compact visual grammar established by Planning and the adaptive queue/content/context composition established by Articles. It also adds an editable AI-generated finding draft for each research question.

## Success criteria

- A researcher can understand what Synthesis is for without first interpreting its data tables.
- Every research-question finding remains traceable to real included articles and evidence excerpts.
- Research-question drafts are editable and never overwritten silently.
- Hundreds or thousands of included studies remain navigable without rendering every record at once.
- Wide matrices scroll only inside their data surface and never create document-level overflow.
- The four synthesis areas share one stable interaction model at desktop, tablet, and mobile.
- Existing report, CSV, and JSON exports remain available.

## Product definition

Synthesis performs four connected jobs:

1. **Answer:** summarize what the evidence says for each research question.
2. **Compare:** inspect how included studies differ across extracted fields.
3. **Interpret:** identify distributions, patterns, disagreements, and evidence gaps.
4. **Sustain:** qualify conclusions with methodological-quality information and direct source links.

Synthesis does not replace extraction or quality assessment. Those activities remain in the included-article workspace; Synthesis reads their results and turns them into an analysis surface.

## Information architecture

The existing four areas remain top-level modes:

- `Perguntas de pesquisa`
- `Matriz de extração`
- `Visualizações`
- `Avaliação da qualidade`

They appear in an equal-width, contained mode switcher below a compact synthesis header. Switching mode changes the tool inside the workspace, not the surrounding page structure.

Each mode adapts the same three-region model:

- **Index:** the relevant queue, field group, visualization, or quality criterion.
- **Content:** the primary analysis surface.
- **Context:** coverage, provenance, filters, quality, or details for the current selection.

On narrower viewports, these regions become `Lista`, `Conteúdo`, and `Contexto` tabs, following the Articles workspace. Region components remain mounted so local filters and selections survive navigation.

## Compact synthesis header

The header contains:

- title `Síntese da revisão`;
- purpose copy: `Transforme dados extraídos em respostas sustentadas`;
- compact coverage metrics for included, extracted, covered RQs, and quality-assessed studies;
- refresh action;
- one export menu grouping the available report, matrix, distribution, and quality exports.

The metrics summarize readiness. They are not separate cards that compete with the primary analysis surface.

## Research questions mode

### Index region

The index lists research questions with:

- RQ number and truncated question;
- linked-evidence count;
- draft state (`Não iniciada`, `Rascunho`, or `Desatualizada`);
- search and state filters;
- server-backed pagination when the list exceeds the configured page size.

Selecting a research question changes the content and context regions without navigating away from Synthesis.

### Content region

The content region presents:

- complete research question;
- synthesis draft editor;
- generate or regenerate action;
- save state and last editor;
- evidence list ordered by quality or relevance;
- search, filters, and server-backed pagination;
- direct links to open each article in its review workspace.

Each evidence row contains only the information needed to judge support: title, year, evidence excerpt, relevant extracted values, and quality label. Full article details stay in the article workspace.

### Context region

The context region reports:

- linked studies versus total included studies;
- proportion with high, medium, low, or missing quality assessment;
- coverage of extraction fields used in the draft;
- evidence gaps and missing-data warnings;
- generation provenance and freshness.

No consistency score is fabricated from counts alone. A consistency statement appears only when it is explicitly supported by structured generation output and its evidence sources.

## AI-generated finding drafts

### Output structure

Generation returns structured content rather than an unverified prose blob:

- concise finding narrative;
- key findings;
- divergences or contradictory results;
- evidence gaps and limitations;
- citations referencing real article IDs used during generation.

The UI renders citations as links. The backend rejects or omits citation IDs that are not part of the generation input.

### Generation behavior

- When the synthesis is empty, a successful first generation is saved automatically.
- When content already exists, regeneration requires explicit confirmation.
- Existing content remains visible and unchanged while regeneration runs.
- Replacement occurs only after the new result is complete, structurally valid, and persisted successfully.
- Failed, cancelled, or invalid generations preserve the current content.
- Generated content is fully editable after creation.
- Manual saves never trigger AI generation.

The generation action is disabled when the RQ has no linked evidence. The empty state explains that articles must first be linked to the RQ from eligibility or extraction.

### Evidence freshness

A deterministic evidence fingerprint covers the RQ text and the linked articles' relevant excerpts, extracted values, RQ links, inclusion state, and quality data.

When the current fingerprint differs from the fingerprint stored with the synthesis, the draft becomes `Desatualizada`. The text remains available and editable; the system offers regeneration but never updates it automatically.

Changing the position or text of a research question does not silently attach an old draft to a different question. An exact question-snapshot match follows a uniquely reordered RQ and updates its displayed number. If no exact match exists, a record at the same position becomes a stale candidate for the edited question and requires explicit regeneration; it is never shown as a current answer.

### Large evidence sets

Generation must not place an unbounded number of articles into one model request.

1. The backend builds a compact evidence packet for each linked article from its title, year, evidence excerpt, relevant extraction values, and quality assessment.
2. Small evidence sets are synthesized directly.
3. Large evidence sets are partitioned into bounded batches and summarized independently with source IDs preserved.
4. A reduction step combines batch findings into the final structured result while retaining source provenance.
5. The final payload is validated against the original permitted article IDs before persistence.

Full PDFs are not sent by this workflow. The synthesis uses review-curated evidence and structured extraction data, keeping cost and provenance predictable.

## Extraction matrix mode

The matrix mode is a data workbench rather than a plain overflowing table.

- The index groups base fields, RQ-linked extraction fields, and supporting metadata.
- Users can search fields and toggle column visibility.
- The content region uses a virtualized or server-paginated table with sticky headers and pinned title/year columns.
- Long values truncate in cells and open in the context region for full reading.
- Article titles open the article workspace.
- Search, quality, RQ, year, source, and completion filters execute before pagination.
- Horizontal scrolling is contained within the matrix surface.
- CSV export uses the active filtered scope by default and clearly offers full-matrix export as a separate choice.

## Visualizations mode

The index lists suggested visualizations grouped by RQ and general distributions. The content region renders one selected visualization at a time instead of an unbounded grid of charts.

The context region explains:

- source field and data type;
- filters and sample size;
- missing-value count;
- categories or aggregation used;
- link to the underlying filtered matrix.

Charts with too many categories aggregate or scroll within their own surface. Qualitative fields render as paginated evidence tables, not compressed charts.

## Quality mode

The index lists the general rating and configured quality criteria. The content region shows the selected distribution and the studies contributing to it. The context region shows the selected study's responses, justification, score, and link to its article workspace.

Article lists are searchable, filterable, and paginated. Quality charts are computed from aggregate backend data and do not require loading every article into the browser.

## Data model

Persist one shared synthesis record per project and research-question position, with a normalized question fingerprint and the full question snapshot to distinguish reordering from editing. The record contains:

- project ID and RQ number;
- question snapshot and normalized question fingerprint;
- editable narrative and structured finding sections;
- validated source references;
- evidence fingerprint;
- generation model metadata;
- generated-at, created-by, updated-at, and updated-by metadata;
- optimistic-lock version.

A unique constraint on project ID and RQ number prevents duplicate active records. When planning changes, the service first matches unique question fingerprints and moves records to their new positions in one transaction. Remaining same-position mismatches are returned only as stale candidates. Duplicate identical question text is resolved by occurrence order, and the UI warns that identical RQs cannot be distinguished reliably until one is renamed.

The synthesis is shared project state. Users with project-edit permission can generate or edit it; read-only members can inspect drafts and sources.

## Service boundaries and API behavior

The synthesis report endpoint remains responsible for aggregate report data but becomes paginated where it currently embeds potentially unbounded row collections.

Dedicated RQ synthesis endpoints provide:

- paginated RQ index and summary state;
- one RQ synthesis with provenance and context metrics;
- paginated evidence for one RQ;
- first generation and confirmed regeneration;
- manual update with optimistic-lock version;
- deletion only through an explicit destructive action.

Generation runs through the existing per-user DeepSeek credential boundary. A missing or invalid key returns the existing actionable credential error and never changes persisted synthesis content.

Backend queries perform pagination, filtering, ordering, and aggregate calculations. The frontend does not fetch every included article and then paginate locally.

## Loading, error, and empty states

- Loading is scoped to the active region or action; mode navigation remains available.
- Initial empty state explains that Synthesis depends on included studies and extracted evidence.
- An RQ with no evidence explains how to link studies and disables generation.
- An RQ with evidence but no draft presents `Gerar rascunho com IA` as the primary action.
- Missing DeepSeek credentials link to Settings.
- Regeneration and save failures preserve the previous content and show retry feedback.
- Stale drafts remain readable with a clear evidence-change notice.
- Failed page or filter requests keep the previous successful result visible when possible.

## Responsive behavior

- Desktop uses index, content, and context regions simultaneously.
- Tablet and mobile use the same region-switching pattern as Articles.
- Header actions stack or wrap without clipping.
- Top-level synthesis modes remain contained and may horizontally scroll only inside their own navigation strip when labels cannot fit.
- Wide data tables scroll only inside the table container.
- Sticky headers and action bars account for the application header and do not cover focused controls.
- At 390 px, document width must equal viewport width.

## Accessibility

- Top-level modes and narrow-layout regions use correct tab semantics.
- Lists expose current selection and counts in accessible names.
- Generation state uses text in addition to color and animation.
- Confirmation dialogs describe that the current synthesis will be replaced only after successful generation.
- Citations are keyboard-accessible links with article titles in their accessible names.
- Virtualized rows retain stable focus behavior and announce the visible result range.
- Charts have textual summaries and access to their underlying data table.

## Testing strategy

Backend tests cover:

- permission enforcement and per-user AI credential handling;
- empty-first-generation automatic persistence;
- regeneration conflict/confirmation behavior;
- preservation of existing content on generation failure;
- evidence fingerprint and stale-state transitions;
- batching and reduction for large evidence sets;
- citation validation against permitted article IDs;
- paginated evidence, matrix, and quality queries;
- optimistic-lock conflicts for collaborative edits.

Frontend tests cover:

- stable four-mode navigation and adaptive region navigation;
- draft generation, confirmation, editing, and save states;
- stale evidence warnings and credential errors;
- search, filters, pagination, and retained selection;
- matrix containment, sticky/pinned behavior, and cell detail;
- single-selected visualization behavior and underlying-data access;
- quality criterion/study navigation;
- accessible tab, dialog, loading, and citation semantics;
- no document-level overflow at 390 px.

Browser QA covers all four modes at 1440 px and 390 px with a large mocked dataset, including generation success/failure, stale state, multiple pages, wide extraction schemas, long titles, and long qualitative values.

## Out of scope

- Autonomous generation without a user action.
- Silent replacement of human-edited synthesis text.
- Direct synthesis from entire PDF files.
- Automated meta-analysis or statistical effect-size calculation.
- Real-time collaborative text cursors.
- A general-purpose rich-text report builder.
- Changing extraction or quality-assessment workflows inside the article workspace.
