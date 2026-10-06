# Synapse: Google Login, User-Managed DeepSeek Keys, and Production Audit

**Date:** 2026-10-05

**Status:** Proposed for implementation

**Production domain:** `https://synapse.labit.dev.br`

## 1. Intent

Prepare Synapse for production by replacing password authentication with Google Sign-In, moving DeepSeek credentials from a shared backend environment variable to encrypted per-user storage, and auditing the complete product through browser-based user journeys.

The audit must go beyond page availability. It must identify and correct controls that do nothing, duplicated or confusing actions, dead-end workflows, missing feedback, visual inconsistencies, accessibility problems, responsive-layout failures, authorization leaks, and failures in the main research workflow.

## 2. Success Criteria

- Any Google account can sign in; password registration and login no longer exist.
- Existing users are linked on their first Google login by a verified, normalized email without losing their projects or articles.
- Synapse sessions use secure server-issued cookies rather than tokens in browser storage.
- Each user may optionally add, replace, validate, or remove their own DeepSeek API key.
- DeepSeek keys are encrypted at rest, isolated by user, never returned in full, and never written to logs.
- Non-AI product areas remain usable without a DeepSeek key; AI actions provide a clear route to configuration.
- Existing project data is backed up and a restore is verified before schema migration.
- The principal end-to-end journeys pass in Playwright at desktop and mobile viewport sizes.
- Every material defect found during the audit receives a reproducible automated test before correction when technically practical.
- Production configuration, deployment, backup, restore, and rollback procedures are documented.

## 3. Scope

### Included

- Authentication and session redesign.
- Per-user DeepSeek key lifecycle and AI-service integration.
- Versioned relational database migrations.
- Backup of current PostgreSQL data and snapshots of active Neo4j/Qdrant state when present.
- Backend, frontend, integration, and Playwright tests.
- Functional, usability, responsive, accessibility, security, and production-readiness review.
- Targeted UI/UX improvements supported by audit evidence.
- Deployment documentation for `synapse.labit.dev.br` and local development.

### Excluded

- Access to Google APIs such as Drive, Gmail, Calendar, or Scholar.
- Organization-only Google accounts or domain restrictions.
- A third-party authentication platform such as Firebase, Auth0, or Supabase Auth.
- Broad visual redesign without evidence from the audited workflows.
- Irreversible cleanup of existing user data.

## 4. Current Constraints

- The repository currently authenticates with email/password and stores an application JWT in `localStorage`.
- `users.passwordHash` is currently required.
- The backend currently accepts a shared `DEEPSEEK_API_KEY` environment variable.
- Database schema creation is not managed by a versioned migration workflow.
- The working tree already contains unrelated user changes. Implementation must not overwrite, reformat, discard, or commit those changes unintentionally.
- A Google Cloud OAuth client does not exist yet. Google requires part of its creation and consent-screen setup to be completed interactively in Google Cloud Console.
- The production DNS entry is planned but not active yet.

## 5. Chosen Architecture

### 5.1 Google identity

Use Google Identity Services only for authentication. The browser renders the official Google button and obtains a Google ID token. It sends that credential over HTTPS to `POST /auth/google`.

The backend validates the token with Google's maintained Python authentication library, including signature, audience, issuer, expiry, and verified-email checks. It does not accept decoded claims without cryptographic verification.

Account resolution follows this order:

1. Find a user by the unique Google `sub` claim.
2. If no `sub` matches, find a legacy user by normalized verified email and attach the `sub`.
3. If neither exists, create a user from the verified Google name, email, and avatar.
4. Reject disabled accounts in every branch.

After initial linking, `google_sub` is the identity key. A later Google email change updates profile data without changing ownership. Automatic linking by email happens only for legacy rows that do not already have a Google identity.

The password registration, password login, and password-change routes and screens are removed. `passwordHash` becomes nullable during a compatibility migration and may be removed in a later cleanup migration after production validation.

### 5.2 Synapse session

After successful Google verification, the backend issues a short, signed Synapse session token in an `HttpOnly` cookie. Production cookies use `Secure`, `SameSite=Lax`, a narrow path/domain, and a finite expiry. Local development receives a deliberately relaxed secure flag only for localhost.

Frontend authentication state is restored through `/auth/profile`. No authentication token is stored in `localStorage`, session storage, URLs, or JavaScript-readable cookies. Logout clears the server cookie and disables automatic Google account selection for the current browser session.

State-changing requests are protected from CSRF. CORS uses an explicit allowlist containing the production origin and documented local origins; wildcard credentials are forbidden.

### 5.3 User-managed DeepSeek credentials

The user model stores:

- encrypted DeepSeek key ciphertext;
- encryption/key-format version;
- last four key characters for masked display;
- validation/update timestamp.

Authenticated settings endpoints support status, create/replace, validate, and delete operations. Responses expose only whether a key exists, its masked suffix, and timestamps.

When a key is submitted, the backend validates its shape and performs a minimal DeepSeek request before persistence. Invalid credentials are rejected with a useful message and are not stored. The plaintext key exists only in request memory and is excluded from logs, traces, exception payloads, and analytics.

Encryption uses an authenticated encryption primitive and a production master key supplied through the deployment secret store. The master key is separate from session-signing material. Ciphertext is bound to the owning user so database row swapping cannot silently reuse another user's credential.

AI routes resolve the authenticated user's credential through a dedicated dependency/service and construct the AI client per request or per safe user-scoped cache entry. A global AI service must never capture one user's key. Missing keys produce a stable machine-readable error that the frontend turns into a direct link to Settings.

## 6. Data Migration and Backup

Introduce Alembic and establish the current relational schema as the migration baseline. The authentication/key migration adds `google_sub` and encrypted-key fields, relaxes the password column, and creates unique/index constraints without modifying project ownership.

Before applying the migration:

1. Generate a timestamped PostgreSQL custom-format dump outside version control.
2. Record database version, migration revision, file size, and checksum.
3. Restore the dump into a separate temporary database.
4. Run integrity checks for users, projects, articles, ownership references, and key workflow tables.
5. Snapshot Neo4j and Qdrant if their running instances contain data; record whether each snapshot was produced.

PostgreSQL remains the authoritative source for users, projects, articles, review decisions, and evidence. Derived graph/vector state must be rebuildable from relational data. Backup files and secret material are ignored by Git.

## 7. Browser Audit and UI/UX Remediation

Playwright is the primary audit instrument. Tests use deterministic local fixtures and a test-only Google credential-verification seam; they never automate a personal Google password or depend on the external Google sign-in UI. One separate manual smoke check confirms the real Google client after Console configuration.

Each journey is exercised at a desktop viewport and a representative mobile viewport. The audit records console errors, failed network requests, unexpected redirects, visible error states, keyboard traps, missing accessible names, layout overflow, and actions with no observable result.

### 7.1 Journey matrix

1. **Authentication:** unauthenticated redirect, mocked Google success, invalid/expired credential, disabled account, legacy email link, new account, refresh/session restore, logout, session expiry.
2. **DeepSeek setup:** no-key state, invalid key, valid key, masked display, replacement, deletion, and isolation between two users.
3. **Dashboard:** initial load, empty state, populated metrics, navigation, and failure/retry state.
4. **Projects:** create, view, edit, change status, delete/confirmation behavior, and ownership isolation.
5. **Planning:** framework selection, research questions, search strings, inclusion/exclusion criteria, extraction schema, quality criteria, manual edits, AI generation, saving, and reload persistence.
6. **Articles:** manual creation, BibTeX import, PDF upload/viewing, filters, pagination, edit, notes, project association, and meaningful empty/error states.
7. **Review workflow:** screening and eligibility decisions, status transitions, bulk or sequential navigation where available, evidence extraction, and quality assessment.
8. **AI outputs:** missing-key guard, article chat, sources/trace, research-question synthesis, synthesis report, exports, upstream API failure, and retry behavior.
9. **Analytics and graph:** PRISMA counts, charts, graph loading/interactions, drill-down navigation, refresh behavior, and degraded backend states.
10. **Settings and layout:** theme persistence, API-key management, user menu, responsive navigation, page titles, and logout.

### 7.2 UI/UX decision rules

- Remove controls that have no meaningful action or whose behavior duplicates a clearer path.
- Repair useful but broken controls when their intended outcome is evident from the workflow.
- Require immediate feedback for async actions: pending, success, actionable error, and safe retry.
- Preserve user input across recoverable failures.
- Use confirmations only for destructive or difficult-to-reverse actions.
- Make disabled states explain why the action is unavailable, especially when the DeepSeek key is missing.
- Normalize terminology, button hierarchy, spacing, modal/panel behavior, empty states, and responsive layouts within the existing design system.
- Ensure keyboard operation, visible focus, semantic labels, sensible heading order, and adequate contrast for all touched flows.
- Prefer targeted improvements backed by screenshots, traces, or reproducible behavior over an unrelated redesign.

Audit findings are prioritized as release blockers, high-impact workflow defects, usability/accessibility improvements, and deferred polish. Release blockers and high-impact defects are fixed before production sign-off.

## 8. Error Handling and Observability

Authentication failures expose stable error codes without leaking token contents. DeepSeek errors distinguish missing key, invalid/revoked key, quota/rate limit, provider outage, timeout, and malformed model response.

Logs include request correlation IDs, authenticated user IDs where appropriate, endpoint, status, and latency. They must redact authorization headers, cookies, Google credentials, DeepSeek keys, uploaded document contents, and sensitive AI prompts/results by default.

Health checks distinguish process health from dependency readiness. Production startup validates the session secret, encryption key, Google client ID, database connectivity, and migration state. DeepSeek is not a startup dependency because credentials are user-managed.

## 9. Verification Strategy

### Backend

- Unit tests for Google-claim validation boundaries, encryption, redaction, and credential resolution.
- API tests for auth/session/CSRF, account linking, account status, API-key lifecycle, user isolation, and missing-key behavior.
- Migration upgrade/downgrade tests against a representative schema.

### Frontend

- Unit tests for auth state, API error mapping, key-status presentation, and changed workflow utilities.
- Build and lint must complete without errors.

### End to end

- Playwright projects for desktop Chromium and a mobile viewport.
- Network and console failure capture attached to failed tests.
- Screenshots/traces for audited checkpoints and all failures.
- Deterministic test data reset that cannot target production.
- A final clean run after all corrections, followed by a manual real-Google smoke test.

## 10. Production Configuration

Required production secrets/configuration include the database and service connections already used by Synapse, a strong session-signing secret, a credential-encryption master key, the Google web client ID, exact allowed origins, cookie policy, and public application URL. A shared `DEEPSEEK_API_KEY` is removed and must not be required at startup.

Google Cloud configuration registers `https://synapse.labit.dev.br` plus documented localhost origins. Because the DNS entry is not active yet, code and local automated tests can be completed first; the real-provider smoke check and production cookie check occur after DNS/TLS and the Google client are configured.

## 11. Deployment and Rollback

Deployment proceeds through backup verification, migration rehearsal, clean automated verification, production secret installation, database migration, application rollout, health/readiness checks, and manual smoke tests.

Rollback preserves the pre-migration dump and previous deploy artifact. If authentication rollout fails, restore the previous application version and, only when schema compatibility requires it, use the verified database restore procedure. No rollback step deletes current data without a second backup.

## 12. Acceptance Gate

Production release is approved only when:

- the verified backup and restore report exists;
- migrations apply successfully to a restored copy of current data;
- backend and frontend suites, lint, and production builds pass;
- the complete Playwright release suite passes with no unexplained console or network errors;
- release-blocking and high-impact audit findings are resolved;
- cross-user authorization/key-isolation tests pass;
- secret scanning and configuration review find no exposed credentials;
- the real Google login, logout, session refresh, and one real DeepSeek call succeed over the production domain;
- rollback steps have been reviewed and are executable.
