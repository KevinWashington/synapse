# Playwright Product Audit and Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a deterministic Playwright release suite, inspect every principal Synapse journey for functional and UX defects, and produce evidence-backed remediation work before production release.

**Architecture:** A dedicated E2E Compose environment supplies isolated PostgreSQL/Neo4j/Qdrant state, a guarded test Google verifier, and a deterministic DeepSeek-compatible stub. Playwright fixtures capture screenshots, traces, console errors, failed requests, accessibility violations, and data-state transitions across desktop and mobile projects.

**Tech Stack:** Playwright Test, Chromium, `@axe-core/playwright`, React/Vite, FastAPI, Docker Compose, PostgreSQL, pytest.

**Spec:** `docs/superpowers/specs/2026-10-05-google-auth-deepseek-production-audit-design.md`

## Global Constraints

- Playwright is the primary audit instrument, not a superficial smoke test.
- Never automate a personal Google password or depend on Google's external UI in CI.
- Test-only authentication and reset paths must fail startup outside `APP_ENV=test`.
- Every discovered release blocker or high-impact defect receives a failing regression test before correction.
- Capture UI evidence before recommending UI/UX changes; invoke `product-design:audit` when executing the visual audit tasks.
- Exercise desktop Chromium and a representative mobile viewport.
- Do not call production URLs or production databases from reset/seed tooling.

## Review Focus

- Empty, small, and large project/article datasets preserve usable controls and responsive layout; exercise in project/article specs.
- Slow or failed API calls preserve user input and expose retryable, actionable states; exercise with Playwright route timing/failure controls.
- A missing DeepSeek key blocks only AI actions and gives a direct Settings path; exercise in auth/settings and AI specs.
- Keyboard-only users can open navigation, dialogs, menus, and complete decisions without focus loss; exercise with keyboard journeys plus axe.
- Double clicks, refreshes, and back navigation do not duplicate projects/articles or lose committed workflow state; exercise in mutation journeys.

---

### Task 1: Build the Isolated Playwright Harness

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Create: `frontend/playwright.config.js`
- Create: `frontend/e2e/support/fixtures.js`
- Create: `frontend/e2e/support/audit.js`
- Create: `frontend/e2e/global.setup.js`
- Create: `frontend/e2e/global.teardown.js`
- Create: `backend/app/testing/e2e_google_verifier.py`
- Create: `backend/scripts/seed_e2e.py`
- Create: `backend/tests/test_e2e_test_guards.py`
- Create: `docker-compose.e2e.yml`

**Interfaces:**
- Produces: `test`, `expect`, `loginAs(page, identity)`, `resetScenario(name)`, `auditPage(page, checkpoint)`, `npm --prefix frontend run e2e`, and `npm --prefix frontend run e2e:ui`.

- [ ] **Step 1: Write failing backend safety tests**

Add `test_e2e_google_verifier_requires_test_environment`, `test_seed_script_rejects_non_test_database`, and `test_e2e_credentials_are_rejected_in_production`.

- [ ] **Step 2: Run and verify RED**

Run: `.venv\Scripts\python.exe -m pytest backend/tests/test_e2e_test_guards.py -v`

Expected: FAIL because guarded test infrastructure does not exist.

- [ ] **Step 3: Add Playwright and axe dependencies/scripts**

Add `@playwright/test` and `@axe-core/playwright`, plus `e2e`, `e2e:headed`, `e2e:ui`, and `e2e:report` scripts. Keep unit-test scripts separate.

- [ ] **Step 4: Implement guarded deterministic identity verification**

Accept only enumerated opaque E2E credentials when `APP_ENV=test`; refuse module activation for every other environment. Produce fixed identities for an existing user, new user, disabled user, and second isolated user.

- [ ] **Step 5: Implement deterministic seed/reset script**

Require a database name ending in `_e2e`; seed stable IDs for two users, empty/populated/large projects, articles across review stages, evidence, and graph/vector rebuild inputs. Make repeat execution idempotent.

- [ ] **Step 6: Configure the E2E Compose stack**

Use separate volume names, database name, cookie names, and ports. Add a deterministic local HTTP stub for DeepSeek validation and representative AI responses. Never reference `backend/.env` secrets.

- [ ] **Step 7: Configure Playwright projects and evidence capture**

Create `desktop-chromium` at 1440x900 and `mobile-chromium` using a Pixel-class viewport. Retain trace, screenshot, video, console logs, page errors, and failed request details on failure; use one worker for stateful scenarios until isolation proves safe.

- [ ] **Step 8: Run safety and harness smoke verification**

Run: `.venv\Scripts\python.exe -m pytest backend/tests/test_e2e_test_guards.py -v`

Run: `npm --prefix frontend run e2e -- --grep "harness smoke"`

Expected: safety tests PASS and smoke journey reaches the login page in both projects.

- [ ] **Step 9: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/playwright.config.js frontend/e2e backend/app/testing backend/scripts/seed_e2e.py backend/tests/test_e2e_test_guards.py docker-compose.e2e.yml
git commit -m "test: add isolated Playwright audit harness"
```

### Task 2: Audit Authentication, Navigation, and Settings

**Files:**
- Create: `frontend/e2e/auth-settings.spec.js`
- Create: `frontend/e2e/navigation-responsive.spec.js`
- Create: `docs/audits/2026-10-05-playwright-findings.md`

**Interfaces:**
- Consumes: `loginAs`, `resetScenario`, and `auditPage` from Task 1.
- Produces: screenshot checkpoints and finding IDs `AUTH-*`, `NAV-*`, and `SET-*`.

- [ ] **Step 1: Capture unauthenticated desktop/mobile screenshots before assertions**

Record login, Google-unavailable, and error states using the audit helper before recommending visual changes.

- [ ] **Step 2: Write authentication journeys**

Cover protected redirect and return path, new user, legacy link, invalid token, disabled user, refresh restore, session expiry, logout, and browser back after logout.

- [ ] **Step 3: Write DeepSeek settings journeys**

Cover no-key state, invalid key, valid key, masked suffix, replacement, deletion confirmation, refresh persistence, and second-user isolation.

- [ ] **Step 4: Write navigation and responsive journeys**

Verify every sidebar/header item has a visible result, active state, accessible name, keyboard path, and usable mobile presentation. Explicitly test the current “Novo projeto” control, user avatar/name, theme control duplication, mobile menu, and settings route aliases.

- [ ] **Step 5: Run and classify findings**

Run: `npm --prefix frontend run e2e -- auth-settings.spec.js navigation-responsive.spec.js`

Record each failure or UX issue with severity, route, viewport, steps, expected/actual behavior, screenshot/trace path, and likely owner file. Do not fix during evidence collection.

- [ ] **Step 6: Commit tests and evidence**

```bash
git add frontend/e2e/auth-settings.spec.js frontend/e2e/navigation-responsive.spec.js docs/audits/2026-10-05-playwright-findings.md
git commit -m "test: audit authentication and navigation journeys"
```

### Task 3: Audit Project Creation and Planning

**Files:**
- Create: `frontend/e2e/projects.spec.js`
- Create: `frontend/e2e/planning.spec.js`
- Modify: `docs/audits/2026-10-05-playwright-findings.md`

**Interfaces:**
- Produces: finding IDs `PRJ-*` and `PLAN-*`.

- [ ] **Step 1: Write project lifecycle journeys**

Cover empty state, create, validation, double submit, open, edit, status change, delete/cancel/confirm, refresh persistence, second-user isolation, loading, server failure, and retry.

- [ ] **Step 2: Write planning journeys**

Cover framework selection, component fields, manual research questions, AI generation with/without key, search strings, criteria, extraction schema, quality schema, saved reload, back navigation, and provider failure without input loss.

- [ ] **Step 3: Add desktop/mobile screenshots and axe scans**

Capture empty, populated, modal/panel, long-content, pending, and error states. Run axe excluding only documented third-party false positives.

- [ ] **Step 4: Run and classify findings**

Run: `npm --prefix frontend run e2e -- projects.spec.js planning.spec.js`

Append evidence and severity to the findings report without implementing fixes.

- [ ] **Step 5: Commit**

```bash
git add frontend/e2e/projects.spec.js frontend/e2e/planning.spec.js docs/audits/2026-10-05-playwright-findings.md
git commit -m "test: audit project and planning journeys"
```

### Task 4: Audit Article Import, Review, Evidence, and Files

**Files:**
- Create: `frontend/e2e/fixtures/articles-small.bib`
- Create: `frontend/e2e/fixtures/article-sample.pdf`
- Create: `frontend/e2e/articles-library.spec.js`
- Create: `frontend/e2e/review-workflow.spec.js`
- Modify: `docs/audits/2026-10-05-playwright-findings.md`

**Interfaces:**
- Produces: finding IDs `ART-*`, `REV-*`, and `FILE-*`.

- [ ] **Step 1: Write library/import journeys**

Cover manual article creation, valid/invalid BibTeX import, duplicate analysis/application, PDF upload/open/download, library filters, query-string trash view, pagination, row/card actions, notes, edit, export, and empty/error states.

- [ ] **Step 2: Write review-stage journeys**

Cover promotion to screening, included/excluded/maybe decisions, required exclusion reason, batch evaluation, full-text status, eligibility, evidence extraction, quality answers/score, previous/next navigation, and persisted reload.

- [ ] **Step 3: Stress representative large-data views**

Use the seeded large project to check interaction latency, overflow, stable selection, filter counts, pagination, and modal/panel responsiveness without embedding the user's large private files in tests.

- [ ] **Step 4: Capture evidence and run axe scans**

Capture table/card modes, import/upload dialogs, article workspace, decision dialogs, and mobile layouts. Record controls with no observable effect or duplicate actions explicitly.

- [ ] **Step 5: Run and classify findings**

Run: `npm --prefix frontend run e2e -- articles-library.spec.js review-workflow.spec.js`

Append evidence and severity to the report.

- [ ] **Step 6: Commit**

```bash
git add frontend/e2e/fixtures frontend/e2e/articles-library.spec.js frontend/e2e/review-workflow.spec.js docs/audits/2026-10-05-playwright-findings.md
git commit -m "test: audit article review journeys"
```

### Task 5: Audit AI, Synthesis, Analytics, and Graph Journeys

**Files:**
- Create: `frontend/e2e/ai-chat.spec.js`
- Create: `frontend/e2e/synthesis-analytics.spec.js`
- Create: `frontend/e2e/graph.spec.js`
- Modify: `docs/audits/2026-10-05-playwright-findings.md`

**Interfaces:**
- Produces: finding IDs `AI-*`, `SYN-*`, `ANL-*`, and `GRAPH-*`.

- [ ] **Step 1: Write AI chat journeys**

Cover no-key guidance, send/pending/result, sources, agent trace, empty prompt, rapid repeat, provider timeout, invalidated key, retry, conversation preservation, and project/article context transitions.

- [ ] **Step 2: Write synthesis/report journeys**

Cover RQ synthesis, synthesis report, empty evidence, refresh, article drill-down, JSON/CSV/report exports, and data consistency between visible counts and exported content.

- [ ] **Step 3: Write analytics and graph journeys**

Cover PRISMA counts, chart labels/tooltips, navigation from metrics, graph load/refresh, zoom/select/details, empty graph, Neo4j failure, and mobile fallback behavior.

- [ ] **Step 4: Capture evidence and run axe scans**

Capture success, empty, slow, and dependency-failure states at both viewports.

- [ ] **Step 5: Run and classify findings**

Run: `npm --prefix frontend run e2e -- ai-chat.spec.js synthesis-analytics.spec.js graph.spec.js`

Append evidence and severity to the report.

- [ ] **Step 6: Commit**

```bash
git add frontend/e2e/ai-chat.spec.js frontend/e2e/synthesis-analytics.spec.js frontend/e2e/graph.spec.js docs/audits/2026-10-05-playwright-findings.md
git commit -m "test: audit AI analytics and graph journeys"
```

### Task 6: Convert Audit Evidence into an Exact Remediation Plan

**Files:**
- Modify: `docs/audits/2026-10-05-playwright-findings.md`
- Create: `docs/superpowers/plans/2026-10-05-playwright-remediation-plan.md`

**Interfaces:**
- Consumes: all finding IDs and evidence from Tasks 2-5.
- Produces: an exact TDD task for every release-blocking/high-impact finding, grouped by owning flow and naming each production/test file.

- [ ] **Step 1: Deduplicate and prioritize findings**

Mark each item `release-blocker`, `high`, `medium`, or `polish`; merge duplicates that share a root cause. Identify controls to remove, controls to repair, copy changes, responsive fixes, accessibility fixes, and backend defects separately.

- [ ] **Step 2: Trace each blocker/high finding to its root cause**

Use request traces, console output, state transitions, and code ownership. Record the smallest production change that would make the failing journey pass; do not infer from screenshots alone.

- [ ] **Step 3: Write the remediation implementation plan**

For each blocker/high finding, name the exact failing Playwright or unit test, expected RED result, production file/signature, GREEN command, broader regression command, and commit boundary. Medium/polish findings remain explicitly deferred or receive similarly exact tasks.

- [ ] **Step 4: Self-review coverage**

Confirm every blocker/high finding maps to exactly one remediation task and every task maps back to evidence. Verify the plan contains no placeholders or generic “fix UI” instructions.

- [ ] **Step 5: Commit audit and remediation plan**

```bash
git add docs/audits/2026-10-05-playwright-findings.md docs/superpowers/plans/2026-10-05-playwright-remediation-plan.md
git commit -m "docs: plan evidence-backed product remediations"
```

### Task 7: Package and Verify the Production Web Stack

**Files:**
- Create: `frontend/Dockerfile`
- Create: `frontend/nginx.conf`
- Create: `docker-compose.production.yml`
- Create: `scripts/production-smoke.ps1`
- Create: `docs/deployment/production-runbook.md`
- Create: `frontend/e2e/production-smoke.spec.js`

**Interfaces:**
- Produces: a static frontend image with SPA fallback and `/api` reverse proxy, production Compose stack, and `production-smoke.ps1 -BaseUrl <https-url>`.

- [ ] **Step 1: Write failing production smoke specification**

Assert SPA deep-link fallback, `/api/health`, `/api/ready`, HTTPS-facing cookie behavior, security headers, unauthenticated redirect, and no source maps or development server exposure.

- [ ] **Step 2: Run and verify RED against the current dev-only image**

Run: `npm --prefix frontend run e2e -- production-smoke.spec.js`

Expected: FAIL because a production frontend image/proxy does not exist.

- [ ] **Step 3: Create multi-stage production frontend image and Nginx configuration**

Build Vite assets with Node, serve with unprivileged Nginx, add SPA fallback, reverse proxy `/api`, compression/cache policy for hashed assets, CSP/frame/content-type/referrer headers, and no caching for `index.html`.

- [ ] **Step 4: Create production Compose definition**

Use immutable images, no source bind mounts, explicit health/readiness dependencies, internal database ports, secret/config injection, migration-before-start behavior, and persistent named volumes. Do not embed passwords.

- [ ] **Step 5: Document deployment and rollback**

Include DNS/TLS prerequisites for `synapse.labit.dev.br`, Google Console origins, backup gate, migration rehearsal, secret rotation, deploy order, smoke commands, log checks, rollback, and restore decision criteria.

- [ ] **Step 6: Build and run production smoke locally**

Run: `docker compose -f docker-compose.yml -f docker-compose.production.yml build`

Run: `docker compose -f docker-compose.yml -f docker-compose.production.yml up -d`

Run: `npm --prefix frontend run e2e -- production-smoke.spec.js`

Expected: build succeeds and smoke spec passes against the local production-shaped stack.

- [ ] **Step 7: Run the complete release gate after the remediation plan is implemented**

Run: `.venv\Scripts\python.exe -m pytest backend/tests -v`

Run: `npm --prefix frontend run test:ci`

Run: `npm --prefix frontend run lint`

Run: `npm --prefix frontend run build`

Run: `npm --prefix frontend run e2e`

Expected: all commands exit 0, all Playwright projects pass, and there are no unexplained console errors or failed requests.

- [ ] **Step 8: Commit**

```bash
git add frontend/Dockerfile frontend/nginx.conf docker-compose.production.yml scripts/production-smoke.ps1 docs/deployment/production-runbook.md frontend/e2e/production-smoke.spec.js
git commit -m "feat: add production web deployment stack"
```
