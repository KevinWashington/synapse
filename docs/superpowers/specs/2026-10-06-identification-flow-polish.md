# Identification Flow and Project UI Polish

## Goal

Make identification work for projects with more than 100 records, keep suspected duplicates under explicit human review, and remove the main layout instability reported in the project header and overview dashboard.

## Approved behavior

- The interface must show the total number of records in the active stage, not present the loaded page of 100 as the total.
- Article lists remain paginated so large projects do not render thousands of rows at once; the user can navigate every page.
- The primary identification action sends every active unique record to screening in one server-side operation, regardless of the current page.
- Before moving records, the server refreshes duplicate detection for active identification records.
- Records in suspected duplicate groups remain in identification for manual review. No suspected duplicate is discarded automatically.
- The result reports moved records, unresolved duplicate groups, and unresolved duplicate records.
- Manual selection and promotion remain available as a secondary exception workflow.
- Duplicate review must expose every detected group, allow choosing one canonical record per group, and apply the existing deduplication operation.
- The project title and objective stay identical across tabs. The objective uses a stable two-line area so tab changes do not move the navigation.
- The overview uses balanced cards at desktop sizes; data sources and evolution must not collapse into narrow columns beside an oversized activity card.

## UX copy

- Primary action: `Enviar todos os únicos para triagem`
- Pagination status: `{loaded} exibidos de {total}`
- Suspected duplicates remain visibly described as requiring review.

## Safety constraints

- All project and owner scoping remains enforced by the backend.
- Bulk promotion affects only `reviewOutcome=active`, `currentPhase=identification`, and records without `duplicateGroupKey` after the fresh analysis.
- Existing user changes in backend files must be preserved.
