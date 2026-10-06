# Google Authentication and User DeepSeek Key Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace password access with Google Sign-In and secure cookie sessions, then route every AI operation through the authenticated user's encrypted DeepSeek key.

**Architecture:** Google Identity Services supplies an ID token that FastAPI verifies and exchanges for a Synapse session cookie plus CSRF token. A dedicated credential vault encrypts DeepSeek keys with AES-256-GCM and resolves a fresh user-scoped `AIService` for every AI request.

**Tech Stack:** React 19, Google Identity Services, FastAPI, google-auth, python-jose, cryptography AESGCM, SQLAlchemy async, Alembic, pytest, Vitest/Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-05-google-auth-deepseek-production-audit-design.md`

## Global Constraints

- Any Google account is allowed; request only identity scopes.
- Link a legacy account by normalized verified email only when it has no `google_sub`; use `google_sub` thereafter.
- Never store application or Google tokens in `localStorage` or `sessionStorage`.
- Never return, log, trace, or commit a plaintext DeepSeek key.
- Users without a DeepSeek key retain all non-AI functionality.
- Preserve unrelated working-tree changes in `backend/app/models/article.py`, `backend/app/routers/articles.py`, `backend/app/services/ai_service.py`, and untracked test/data files.

## Review Focus

- A verified email already bound to a different `google_sub` is rejected rather than silently relinked; prove in `backend/tests/test_google_auth.py`.
- Disabled users cannot create or restore sessions even with a valid Google token; prove in `backend/tests/test_google_auth.py`.
- Missing, mismatched, or absent CSRF tokens reject mutating cookie-authenticated requests; prove in `backend/tests/test_session_security.py`.
- Corrupt ciphertext and a ciphertext copied to another user fail closed without exposing key material; prove in `backend/tests/test_deepseek_credentials.py`.
- Two concurrent users' AI requests receive only their own key; prove in `backend/tests/test_user_ai_service.py`.

---

### Task 1: Add Auth Dependencies, User Fields, and Migration

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/app/models/user.py`
- Create: `backend/migrations/versions/0002_google_identity_and_deepseek_credentials.py`
- Create: `backend/tests/test_user_auth_migration.py`

**Interfaces:**
- Produces nullable `User.passwordHash`, unique nullable `User.googleSub`, `deepseekKeyCiphertext`, `deepseekKeyVersion`, `deepseekKeyLastFour`, and `deepseekKeyUpdatedAt`.

- [ ] **Step 1: Write failing model and migration tests**

Add `test_user_model_exposes_google_and_encrypted_key_fields`, `test_auth_migration_preserves_existing_user_project_ownership`, and `test_google_sub_is_unique_when_present`.

- [ ] **Step 2: Run the tests and verify RED**

Run: `.venv\Scripts\python.exe -m pytest backend/tests/test_user_auth_migration.py -v`

Expected: FAIL because the fields and revision do not exist.

- [ ] **Step 3: Add dependencies and model fields**

Pin `google-auth`, `cryptography`, and test HTTP dependencies compatible with the existing FastAPI stack. Map the exact fields above; keep legacy password hashes but allow null.

- [ ] **Step 4: Implement migration `0002`**

Add nullable columns, a unique partial index for non-null `googleSub`, and a downgrade that removes only the new fields/index. Do not rewrite user IDs or ownership columns.

- [ ] **Step 5: Run migration tests and verify GREEN**

Run: `.venv\Scripts\python.exe -m pytest backend/tests/test_user_auth_migration.py backend/tests/test_migrations.py -v`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/requirements.txt backend/app/models/user.py backend/migrations/versions/0002_google_identity_and_deepseek_credentials.py backend/tests/test_user_auth_migration.py
git commit -m "feat: add Google identity and credential fields"
```

### Task 2: Verify Google Identity and Resolve Accounts

**Files:**
- Create: `backend/app/services/google_identity_service.py`
- Create: `backend/tests/test_google_identity_service.py`

**Interfaces:**
- Produces: `GoogleIdentity(sub: str, email: str, email_verified: bool, name: str, avatar: str | None)` and `GoogleIdentityService.verify(credential: str) -> GoogleIdentity`.

- [ ] **Step 1: Write failing verification tests**

Add tests for valid claims, wrong audience, wrong issuer, expired token, unverified email, missing `sub`, normalized email, and provider/network failure. Assert that errors contain stable codes but never the credential.

- [ ] **Step 2: Run and verify RED**

Run: `.venv\Scripts\python.exe -m pytest backend/tests/test_google_identity_service.py -v`

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement `GoogleIdentityService`**

Use `google.oauth2.id_token.verify_oauth2_token` with `settings.GOOGLE_CLIENT_ID`; translate validation failures into `GoogleIdentityError(code: str, public_message: str)` and normalize email using `strip().casefold()`.

- [ ] **Step 4: Run and verify GREEN**

Run: `.venv\Scripts\python.exe -m pytest backend/tests/test_google_identity_service.py -v`

Expected: PASS with no credential content in captured logs.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/google_identity_service.py backend/tests/test_google_identity_service.py
git commit -m "feat: verify Google identity tokens"
```

### Task 3: Implement Secure Session Cookies and CSRF

**Files:**
- Modify: `backend/app/core/security.py`
- Modify: `backend/app/core/dependencies.py`
- Create: `backend/app/core/csrf.py`
- Create: `backend/tests/test_session_security.py`

**Interfaces:**
- Produces: `create_session_token(user_id: int) -> str`, `decode_session_token(token: str) -> dict | None`, `set_session_cookies(response: Response, user_id: int) -> None`, `clear_session_cookies(response: Response) -> None`, and `require_csrf(request: Request) -> None`.

- [ ] **Step 1: Write failing cookie and CSRF tests**

Cover production cookie attributes, localhost secure behavior, expiry, tampering, cookie-based current-user lookup, missing cookie, matching CSRF header/cookie, mismatch, and unsafe request without CSRF.

- [ ] **Step 2: Run and verify RED**

Run: `.venv\Scripts\python.exe -m pytest backend/tests/test_session_security.py -v`

Expected: FAIL against bearer-token-only dependencies.

- [ ] **Step 3: Implement signed session helpers**

Use `SESSION_SECRET`, the configured JWT algorithm, `sub` as the user ID, `iat`, `exp`, and a token type claim of `session`. Set only configured cookie names and exact production attributes.

- [ ] **Step 4: Implement double-submit CSRF**

Create a random readable CSRF cookie and require the same value in `X-CSRF-Token` for `POST`, `PUT`, `PATCH`, and `DELETE`. Exempt only the Google login endpoint and process health endpoints.

- [ ] **Step 5: Switch `get_current_user` to the session cookie**

Remove browser bearer-token dependency. Keep stable 401 responses for absent, invalid, expired, deleted, and disabled users.

- [ ] **Step 6: Run and verify GREEN**

Run: `.venv\Scripts\python.exe -m pytest backend/tests/test_session_security.py -v`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/core/security.py backend/app/core/dependencies.py backend/app/core/csrf.py backend/tests/test_session_security.py
git commit -m "feat: use secure cookie sessions"
```

### Task 4: Replace Password Routes with Google Authentication

**Files:**
- Modify: `backend/app/schemas/auth.py`
- Modify: `backend/app/routers/auth.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_google_auth.py`

**Interfaces:**
- Produces: `POST /api/auth/google { credential }`, `GET /api/auth/profile`, `PUT /api/auth/profile`, and `POST /api/auth/logout`; login response contains user data but no token.

- [ ] **Step 1: Write failing API tests**

Cover new account creation, legacy email linking, returning `googleSub`, conflicting link rejection, disabled accounts, profile restore, logout cookie deletion, and 404/405 behavior for removed password routes.

- [ ] **Step 2: Run and verify RED**

Run: `.venv\Scripts\python.exe -m pytest backend/tests/test_google_auth.py -v`

Expected: FAIL because `/google` is absent and password endpoints still exist.

- [ ] **Step 3: Implement `GoogleCredentialRequest` and account resolution**

Add `credential: str` with a strict maximum length. Resolve by `googleSub`, then unbound normalized email, then create. Update name/avatar/last login without changing ownership.

- [ ] **Step 4: Issue and clear cookies in auth routes**

Return `AuthResponse` without `token`; set cookies on Google login and clear both cookies on logout. Apply CSRF to profile mutation and logout.

- [ ] **Step 5: Remove password endpoints and schemas**

Delete register, password login, password hashing calls, and password change from public routing while leaving legacy hash data untouched.

- [ ] **Step 6: Run auth and security tests**

Run: `.venv\Scripts\python.exe -m pytest backend/tests/test_google_auth.py backend/tests/test_session_security.py -v`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/auth.py backend/app/routers/auth.py backend/app/main.py backend/tests/test_google_auth.py
git commit -m "feat: replace password login with Google"
```

### Task 5: Move Frontend Authentication to Google and Cookies

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `frontend/src/services/api.js`
- Modify: `frontend/src/features/auth/services/authService.js`
- Modify: `frontend/src/features/auth/hooks/useAuthProvider.js`
- Modify: `frontend/src/features/auth/pages/LoginScreen.jsx`
- Delete: `frontend/src/features/auth/pages/RegisterScreen.jsx`
- Delete: `frontend/src/features/auth/components/PasswordField.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/pages/Layout.jsx`
- Create: `frontend/src/features/auth/components/GoogleSignInButton.jsx`
- Create: `frontend/src/features/auth/hooks/useAuthProvider.test.jsx`
- Create: `frontend/src/features/auth/components/GoogleSignInButton.test.jsx`

**Interfaces:**
- Produces: `authService.loginWithGoogle(credential: string)`, `authService.restoreSession()`, and `GoogleSignInButton({ onCredential, disabled })`.

- [ ] **Step 1: Add Vitest and Testing Library scripts/dependencies**

Add `test` and `test:ci` scripts using jsdom without replacing the existing lint/build scripts.

- [ ] **Step 2: Write failing auth UI tests**

Assert initial `/profile` restoration with cookies, Google credential submission, return-to-original-route behavior, failure feedback, logout, no token storage, and Google script load failure.

- [ ] **Step 3: Run and verify RED**

Run: `npm --prefix frontend run test:ci -- src/features/auth`

Expected: FAIL because Google auth APIs/components are absent.

- [ ] **Step 4: Make API requests credentialed and CSRF-aware**

Set `credentials: "include"` on API requests. Read the configured CSRF cookie only for unsafe methods and send `X-CSRF-Token`; remove bearer-token and 401 local-storage cleanup logic.

- [ ] **Step 5: Implement session-only auth state**

On mount call `/api/auth/profile`; expose `loginWithGoogle`, `logout`, `updateUser`, `isAuthenticated`, and loading/error state. Remove token/user persistence, register, password change, and `getToken`.

- [ ] **Step 6: Implement the official Google button wrapper**

Load `https://accounts.google.com/gsi/client` once, initialize with `VITE_GOOGLE_CLIENT_ID`, render the button, handle unavailable/misconfigured script states, and avoid logging the credential.

- [ ] **Step 7: Replace login UI and routes**

Show only Google Sign-In plus useful loading/error copy. Remove `/register` and password-related imports. Use `user.avatar` and `user.name` in the account menu; await logout before navigation.

- [ ] **Step 8: Run tests, lint, and build**

Run: `npm --prefix frontend run test:ci -- src/features/auth`

Run: `npm --prefix frontend run lint`

Run: `npm --prefix frontend run build`

Expected: all exit 0.

- [ ] **Step 9: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/services/api.js frontend/src/features/auth frontend/src/App.jsx frontend/src/pages/Layout.jsx
git commit -m "feat: add Google sign-in experience"
```

### Task 6: Encrypt and Manage User DeepSeek Credentials

**Files:**
- Create: `backend/app/services/credential_vault.py`
- Create: `backend/app/services/deepseek_credential_service.py`
- Create: `backend/app/schemas/settings.py`
- Create: `backend/app/routers/settings.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_deepseek_credentials.py`

**Interfaces:**
- Produces: `CredentialVault.encrypt(user_id: int, plaintext: str) -> EncryptedCredential`, `CredentialVault.decrypt(user_id: int, ciphertext: str, version: int) -> str`, `DeepSeekCredentialService.validate(api_key: str) -> None`, and `GET/PUT/DELETE /api/settings/deepseek-key`.

- [ ] **Step 1: Write failing vault and endpoint tests**

Cover round-trip encryption, randomized ciphertext, wrong user AAD, corrupt ciphertext, masked status, valid save, invalid-key rejection without persistence, replacement, deletion, CSRF, and cross-user isolation.

- [ ] **Step 2: Run and verify RED**

Run: `.venv\Scripts\python.exe -m pytest backend/tests/test_deepseek_credentials.py -v`

Expected: FAIL because vault and endpoints do not exist.

- [ ] **Step 3: Implement AES-256-GCM vault**

Decode a base64 32-byte master key, use a new 96-bit nonce per encryption, bind `synapse:user:<id>:deepseek:v1` as AAD, and serialize version/nonce/ciphertext without logging plaintext.

- [ ] **Step 4: Implement DeepSeek credential validation**

Call a minimal authenticated DeepSeek endpoint/request through `httpx` with strict timeout. Map invalid credentials, rate limit, timeout, and provider outage to stable codes; persist only after successful validation.

- [ ] **Step 5: Implement authenticated settings endpoints**

Status returns `{ configured, maskedKey, updatedAt }`; PUT accepts a bounded key and stores ciphertext/version/last four/timestamp; DELETE clears all key fields. Apply CSRF to mutations.

- [ ] **Step 6: Run and verify GREEN**

Run: `.venv\Scripts\python.exe -m pytest backend/tests/test_deepseek_credentials.py -v`

Expected: PASS and captured logs contain no submitted test keys.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/credential_vault.py backend/app/services/deepseek_credential_service.py backend/app/schemas/settings.py backend/app/routers/settings.py backend/app/main.py backend/tests/test_deepseek_credentials.py
git commit -m "feat: store encrypted user DeepSeek keys"
```

### Task 7: Scope Every AI Request to the Authenticated User

**Files:**
- Modify: `backend/app/services/ai_service.py`
- Modify: `backend/app/core/dependencies.py`
- Modify: `backend/app/routers/ai.py`
- Modify: `backend/app/routers/articles.py`
- Create: `backend/tests/test_user_ai_service.py`

**Interfaces:**
- Produces: `async get_user_ai_service(current_user: User, db: AsyncSession) -> AIService`; raises `DeepSeekKeyRequiredError` with code `DEEPSEEK_KEY_REQUIRED`.

- [ ] **Step 1: Write failing user-scope tests**

Add tests for no configured key, correct decryption/AAD, two-user concurrency, invalidated key mapping, and all AI/article-evaluation routes resolving through the dependency instead of the global factory.

- [ ] **Step 2: Run and verify RED**

Run: `.venv\Scripts\python.exe -m pytest backend/tests/test_user_ai_service.py -v`

Expected: FAIL because routes call global `get_ai_service()`.

- [ ] **Step 3: Make `AIService` require an explicit API key**

Remove fallback to `settings.DEEPSEEK_API_KEY`; retain configurable model/base URL. Keep current uncommitted behavior changes intact while editing this file.

- [ ] **Step 4: Implement `get_user_ai_service`**

Read and decrypt only the current user's credential, construct an uncached service, and map missing/corrupt credentials to sanitized public errors.

- [ ] **Step 5: Replace every global AI factory call**

Inject the user-scoped service into all endpoints in `ai.py` and the evaluation paths in `articles.py`. Verify by `rg` that no request route calls the legacy global factory.

- [ ] **Step 6: Run targeted and full backend tests**

Run: `.venv\Scripts\python.exe -m pytest backend/tests/test_user_ai_service.py backend/tests/test_ai_service_generation.py -v`

Run: `.venv\Scripts\python.exe -m pytest backend/tests -v`

Expected: all tests pass; no key appears in output.

- [ ] **Step 7: Commit only the intended hunks**

Use `git diff` and interactive staging or equivalent precise staging so pre-existing user changes are not accidentally included.

```bash
git commit -m "feat: scope AI access to user credentials"
```

### Task 8: Add DeepSeek Settings and Missing-Key UX

**Files:**
- Create: `frontend/src/features/settings/services/settingsService.js`
- Create: `frontend/src/features/settings/components/DeepSeekKeyCard.jsx`
- Create: `frontend/src/features/settings/components/DeepSeekKeyCard.test.jsx`
- Modify: `frontend/src/features/settings/hooks/useSettingsPage.js`
- Modify: `frontend/src/features/settings/components/SettingsPageContent.jsx`
- Modify: `frontend/src/services/chatService.js`
- Modify: `frontend/src/lib/toast.js`
- Modify as discovered by route inventory: AI action components under `frontend/src/features/ai/` and `frontend/src/features/projects/components/PlanningActionButton.jsx`

**Interfaces:**
- Produces: `settingsService.getDeepSeekKeyStatus()`, `saveDeepSeekKey(apiKey: string)`, `deleteDeepSeekKey()`, and shared handling for API code `DEEPSEEK_KEY_REQUIRED`.

- [ ] **Step 1: Write failing settings UI tests**

Cover unconfigured/configured status, masked suffix, show/hide local input, invalid-key feedback, save pending state, replacement, destructive confirmation, deletion, and plaintext absence after completion.

- [ ] **Step 2: Run and verify RED**

Run: `npm --prefix frontend run test:ci -- src/features/settings`

Expected: FAIL because the card/service do not exist.

- [ ] **Step 3: Implement service and page hook**

Fetch status on settings load; expose save/delete mutations and stable loading/error/success state without persisting the plaintext key.

- [ ] **Step 4: Implement `DeepSeekKeyCard`**

Explain that the key is optional, link to DeepSeek key creation, show only the masked suffix, require explicit confirmation for deletion, and provide accessible labels/status announcements.

- [ ] **Step 5: Add application-wide missing-key guidance**

Map `DEEPSEEK_KEY_REQUIRED` to a consistent message and action linking to `/settings`; do not disable unrelated navigation or data editing.

- [ ] **Step 6: Run frontend and backend verification**

Run: `npm --prefix frontend run test:ci`

Run: `npm --prefix frontend run lint`

Run: `npm --prefix frontend run build`

Run: `.venv\Scripts\python.exe -m pytest backend/tests -v`

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/settings frontend/src/services/chatService.js frontend/src/lib/toast.js frontend/src/features/ai frontend/src/features/projects/components/PlanningActionButton.jsx
git commit -m "feat: add personal DeepSeek key settings"
```

### Task 9: Update Configuration and Authentication Documentation

**Files:**
- Modify: `README.md`
- Modify: `backend/.env.example`
- Create: `docs/deployment/google-auth.md`
- Create: `docs/deployment/production-configuration.md`

**Interfaces:**
- Documents: local/production origins, Google Console interactive steps, secret generation/storage, cookie behavior, credential rotation, and removal of shared DeepSeek configuration.

- [ ] **Step 1: Update setup instructions and remove password/shared-key guidance**

Document `https://synapse.labit.dev.br`, localhost origins, required Google client ID, session/encryption secrets, and optional per-user DeepSeek setup.

- [ ] **Step 2: Document Google Console steps**

Include project creation, branding/consent screen, Web client creation, exact authorized origins, testing users if Google requires them, and the fact that OAuth-client creation requires interactive Console confirmation.

- [ ] **Step 3: Verify no obsolete setup references remain**

Run: `rg -n "DEEPSEEK_API_KEY|Crie uma conta|senha|/register|change-password" README.md backend/.env.example docs/deployment frontend/src backend/app`

Expected: only intentional migration/history references remain.

- [ ] **Step 4: Run the full verification gate**

Run: `.venv\Scripts\python.exe -m pytest backend/tests -v`

Run: `npm --prefix frontend run test:ci`

Run: `npm --prefix frontend run lint`

Run: `npm --prefix frontend run build`

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add README.md backend/.env.example docs/deployment/google-auth.md docs/deployment/production-configuration.md
git commit -m "docs: document Google auth and user API keys"
```
