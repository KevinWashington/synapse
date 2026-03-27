# Coding Conventions

**Analysis Date:** 2026-03-27

## Naming Patterns

**Files:**
- Frontend React files mostly use `PascalCase.jsx` for pages/components (examples: `frontend/src/pages/Dashboard.jsx`, `frontend/src/pages/ProjetoDetalhes.jsx`, `frontend/src/components/ProtectedRoute.jsx`).
- Frontend service/context/helper files use `camelCase.js/.jsx/.ts` (examples: `frontend/src/services/authService.js`, `frontend/src/context/authContext.jsx`, `frontend/src/lib/frameworkConfig.js`).
- Backend Python modules use `snake_case.py` (examples: `backend/app/core/dependencies.py`, `backend/app/services/graph_sync_service.py`).

**Functions and Methods:**
- Frontend functions use `camelCase` (`getAuthToken`, `updateAiProvider`, `validateToken`) in `frontend/src/services/api.js`, `frontend/src/context/aiConfigContext.jsx`, `frontend/src/services/authService.js`.
- Backend functions and async endpoints use `snake_case` (`create_access_token`, `get_current_user`, `get_all_projects`) in `backend/app/core/security.py`, `backend/app/core/dependencies.py`, `backend/app/routers/projects.py`.

**Data Models and Types:**
- Backend ORM and schema classes use `PascalCase` (`Project`, `UserResponse`, `ProjectCreate`) in `backend/app/models/project.py`, `backend/app/schemas/auth.py`, `backend/app/schemas/project.py`.
- API payload fields currently mix conventions by design:
  - camelCase (`researchQuestions`, `ownerId`, `isActive`) in `backend/app/schemas/project.py` and `backend/app/schemas/auth.py`
  - Portuguese legacy keys (`criteriosInclusao`, `pessoa`, `intervencao`) in `backend/app/schemas/project.py`

## Code Style

**Frontend (JavaScript/React):**
- ESLint is configured and active via `frontend/eslint.config.js`.
- Enforced rule observed: `no-unused-vars` with ignore pattern for uppercase names.
- Formatting style in source files uses semicolons and double quotes consistently in representative files (`frontend/src/App.jsx`, `frontend/src/services/api.js`, `frontend/src/context/authContext.jsx`).

**Backend (Python/FastAPI):**
- No formatter/linter config file detected in repo root or `backend/` (no `pyproject.toml`, no `ruff`/`flake8`/`black` config).
- Style is mostly PEP8-like by convention in inspected files (`backend/app/main.py`, `backend/app/routers/auth.py`, `backend/app/services/ai_service.py`).

## Architecture Conventions

**Backend layering:**
- Routing layer in `backend/app/routers/*.py`.
- Validation/contract layer in `backend/app/schemas/*.py`.
- Persistence models in `backend/app/models/*.py`.
- Shared concerns (auth/dependencies/config/database) in `backend/app/core/*.py`, `backend/app/config.py`, `backend/app/database.py`.
- Domain services for AI/embeddings/graph/RAG in `backend/app/services/*.py`.

**Frontend layering:**
- Route orchestration in `frontend/src/App.jsx`.
- Feature modules under `frontend/src/features/*` with feature-level exports (`frontend/src/features/auth/index.js`, `frontend/src/features/ai/index.js`).
- Generic API transport in `frontend/src/services/api.js`; domain services wrap it (`frontend/src/services/authService.js`).
- Reusable UI in `frontend/src/components` and `frontend/src/components/ui`.

## State Management Conventions

- Global client state is primarily React Context + hooks:
  - auth state in `frontend/src/context/authContext.jsx`
  - AI provider/model state in `frontend/src/features/ai/context/AIConfigContext.jsx`
- Session persistence is localStorage-backed (`token`, `user`, `aiProvider`, `ollamaConfig`, `geminiConfig`) in `frontend/src/context/authContext.jsx`, `frontend/src/services/api.js`, `frontend/src/features/ai/context/AIConfigContext.jsx`.
- No Redux/Zustand/Jotai detected.

## API Contract Patterns

- Backend contract pattern: typed request/response via Pydantic models and `response_model` in routers (`backend/app/routers/auth.py`, `backend/app/routers/projects.py`, `backend/app/routers/articles.py`).
- Error shape pattern: `HTTPException` with structured `detail` object containing `error` and `message` keys (`backend/app/core/dependencies.py`, `backend/app/routers/auth.py`, `backend/app/routers/projects.py`).
- Frontend transport pattern: one shared request method with auth injection and standardized `ApiError` (`frontend/src/services/api.js`).
- Frontend services use pass-through wrappers to endpoint paths (`frontend/src/services/authService.js`).

## Config and Secret Handling Conventions

- Backend settings use `pydantic-settings` with `.env` loading (`backend/app/config.py`).
- Frontend runtime config uses Vite env vars (`import.meta.env.VITE_API_URL`) in `frontend/src/services/api.js`.
- Secrets are expected from env/config surfaces but currently there are insecure defaults in code (`JWT_SECRET`, `NEO4J_PASSWORD`, default DB URL) in `backend/app/config.py`.
- LocalStorage currently stores auth token and user payload in plain browser storage (`frontend/src/context/authContext.jsx`, `frontend/src/services/api.js`).

## Import Organization

**Common observed order:**
1. Third-party imports
2. Internal module imports
3. Local constants/helpers

Examples in:
- `backend/app/routers/auth.py`
- `frontend/src/App.jsx`
- `frontend/src/services/api.js`

## Logging and Error Handling

- Frontend uses `console.error` for transport/auth failures (`frontend/src/services/api.js`, `frontend/src/services/authService.js`, `frontend/src/context/authContext.jsx`).
- Backend primarily raises HTTP exceptions for client-facing failures and uses `print` for service-level operational logs (`backend/app/routers/articles.py`, `backend/app/services/ai_service.py`).

## Prescriptive Guidance for New Code

- Match file naming by layer: `PascalCase.jsx` for UI pages/components, `camelCase.js` for frontend services/context, `snake_case.py` for backend modules.
- Keep backend endpoint contracts in schema classes and route decorators rather than inline dict assumptions.
- Keep API errors in consistent `{ error, message }` detail structure for frontend compatibility.
- Do not introduce additional field naming styles; prefer existing project payload conventions when touching existing endpoints.

---

*Convention analysis: 2026-03-27*
