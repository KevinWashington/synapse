# Execution baseline

Branch `refactor/architecture-maintainability`, isolated worktree `.worktrees/architecture-maintainability`, base `5902948`. Existing local documents/screenshots/test scripts remain in the original checkout and were not copied into commits. Environment files are ignored; credentials are omitted.

Frontend lint and production build passed before implementation. Initial Vitest run passed 54 suites/307 tests; six suites were blocked by a dependency junction resolving outside the worktree. Installing local dependencies with `npm ci` resolved the import restriction. A subsequent full run overlapped newly introduced RED tests and is not claimed as a clean original baseline.

Backend initially could not connect to PostgreSQL. A dedicated disposable `synapse-refactor-test-postgres` container (no user volumes) was created. A Linux runner using the local backend image and worktree bind mount passed all 264 tests in 30.88 seconds after T1/T2 integration; collaboration alone passed 93 tests in 12.94 seconds. Windows test runners were stopped before further shared-database testing.

E2E requires dedicated API/frontend, Neo4j/Qdrant and authenticated test sessions. These were not available for the initial baseline. The existing Playwright base URL must be explicitly configured to the test frontend port.

Regression set: full pytest, frontend lint/typecheck/Vitest/build, migration upgrade/downgrade, index transaction/concurrency tests, and E2E review/collaboration/synthesis/adaptation/analytics when the isolated stack is ready. Environmental failures are not test approvals.
