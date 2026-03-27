# Testing Patterns

**Analysis Date:** 2026-03-27

## Current Test Footprint

- No test files detected for frontend or backend using `*.test.*` / `*.spec.*` patterns.
- No dedicated test directories detected (`tests/`, `test/`, `__tests__/`).
- No frontend test runner configuration detected (no `vitest.config.*`, `jest.config.*`, `playwright.config.*`, `cypress.config.*`).
- No CI workflow files detected under `.github/workflows/`.

## Tooling Signals Present

**Backend:**
- `pytest==8.3.0` and `pytest-asyncio==0.24.0` are present in `backend/requirements.txt`.
- This indicates intended Python testing direction, but no implemented suite is present.

**Frontend:**
- ESLint is configured (`frontend/eslint.config.js`), but linting is not testing.
- `frontend/package.json` contains `dev`, `build`, `lint`, `preview` scripts only; no `test` script.

## Effective Test Framework Status

**Runner:**
- Backend: Not configured in repo files beyond dependency declaration.
- Frontend: Not detected.

**Assertion Library:**
- Not detected (no actual tests).

**Run Commands:**
```bash
# Currently available quality command
cd frontend && npm run lint

# Backend test dependencies exist, but no suite is present
cd backend && pytest
```

## Gaps and Risks

**Gap 1: Authentication regression risk (High)**
- Critical paths are untested across token lifecycle and protected routes.
- Files: `backend/app/core/security.py`, `backend/app/core/dependencies.py`, `backend/app/routers/auth.py`, `frontend/src/context/authContext.jsx`, `frontend/src/services/authService.js`.

**Gap 2: API contract drift risk (High)**
- Response and error structures are hand-assembled in multiple routers with no contract tests.
- Files: `backend/app/routers/auth.py`, `backend/app/routers/projects.py`, `backend/app/routers/articles.py`, `backend/app/routers/stats.py`.

**Gap 3: Data mutation flows unverified (High)**
- CRUD endpoints perform multiple DB operations and response shaping with no automated checks.
- Files: `backend/app/routers/projects.py`, `backend/app/routers/articles.py`.

**Gap 4: AI parsing and fallback behavior unverified (High)**
- Complex parsing and fallback logic exists around LLM outputs and embeddings.
- Files: `backend/app/services/ai_service.py`, `backend/app/services/embedding_service.py`, `backend/app/services/rag_service.py`.

**Gap 5: Frontend transport error handling unverified (Medium)**
- Binary/JSON branching, 401 handling, and custom `ApiError` behavior are untested.
- Files: `frontend/src/services/api.js`.

**Gap 6: State persistence/rehydration unverified (Medium)**
- Context rehydration from localStorage has no test coverage.
- Files: `frontend/src/context/authContext.jsx`, `frontend/src/features/ai/context/AIConfigContext.jsx`.

## Practical Next Test Priorities

1. Backend auth unit tests first.
- Validate `hash_password`, `verify_password`, `create_access_token`, `decode_token` behavior and expiry handling in `backend/app/core/security.py`.

2. Backend dependency and route-level auth tests.
- Validate `get_current_user` and standard auth failure responses in `backend/app/core/dependencies.py` and `backend/app/routers/auth.py`.

3. Backend API integration tests for high-traffic CRUD.
- Cover create/list/update/delete for projects and articles including owner scoping and 404 behavior in `backend/app/routers/projects.py` and `backend/app/routers/articles.py`.

4. Backend AI service unit tests with mocked LLM output.
- Validate numbered-list parsing, JSON extraction, and fallback paths in `backend/app/services/ai_service.py`.

5. Frontend service and context unit tests.
- Mock `fetch` to test `ApiService` success/error paths and 401 cleanup in `frontend/src/services/api.js`.
- Test login/logout/rehydration flows in `frontend/src/context/authContext.jsx`.

6. Add baseline quality gate.
- Introduce frontend test script and backend test invocation in project docs/scripts so automated checks are runnable in local and CI environments.

## Suggested Minimal Baseline (Near Term)

- Backend: create `backend/tests/` with `pytest` + `pytest-asyncio` tests for auth and one router module.
- Frontend: add Vitest + React Testing Library and cover `api.js` plus one context provider.
- CI: add one workflow under `.github/workflows/` to run lint and tests on push/PR.

---

*Testing analysis: 2026-03-27*
