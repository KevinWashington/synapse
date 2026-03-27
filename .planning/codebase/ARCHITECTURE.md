# Architecture

**Analysis Date:** 2026-03-27

## Pattern Overview

**Overall:** Layered web application with a split frontend/backend architecture and service-oriented backend modules.

**High-level component diagram (text):**

```text
Browser (React + React Router)
  -> frontend/src/services/api.js (HTTP client, token injection)
    -> FastAPI app (backend/app/main.py)
      -> Routers (backend/app/routers/*.py)
        -> Core dependencies/security (backend/app/core/*.py)
        -> SQLAlchemy async session (backend/app/database.py)
          -> PostgreSQL (tables + pgvector)
        -> AI + retrieval services (backend/app/services/ai_service.py, rag_service.py, embedding_service.py)
        -> Graph sync services (backend/app/services/graph_sync_service.py, neo4j_service.py)
          -> Neo4j graph DB
```

**Key Characteristics:**
- Frontend and backend are decoupled by REST APIs under `/api/*` (routing in `frontend/src/App.jsx`, backend in `backend/app/main.py`).
- Backend uses router -> dependency -> model/service layering (`backend/app/routers`, `backend/app/core`, `backend/app/models`, `backend/app/services`).
- Domain data is persisted in PostgreSQL; semantic and graph relationships are handled through pgvector and Neo4j (`backend/app/database.py`, `backend/app/services/rag_service.py`, `backend/app/services/neo4j_service.py`).

## Backend/Frontend Boundary

**Boundary Contract:**
- Frontend calls backend over HTTP using `frontend/src/services/api.js`.
- API base URL is configured by `VITE_API_URL` with fallback `http://localhost:5000` in `frontend/src/services/api.js`.
- Backend exposes route groups via `backend/app/main.py`:
  - `/api/auth` -> `backend/app/routers/auth.py`
  - `/api/projetos` -> `backend/app/routers/projects.py` and `backend/app/routers/articles.py`
  - `/api/*` AI/stats -> `backend/app/routers/ai.py`, `backend/app/routers/stats.py`

## Layers

**Frontend UI and Routing Layer:**
- Purpose: Route rendering, auth gating, and page composition.
- Location: `frontend/src/main.jsx`, `frontend/src/App.jsx`, `frontend/src/pages/Layout.jsx`, `frontend/src/components/ProtectedRoute.jsx`.
- Depends on: Feature providers and service wrappers.
- Used by: End users via browser.

**Frontend Feature/Service Layer:**
- Purpose: Encapsulate use-cases and API calls.
- Location: `frontend/src/features/*`, `frontend/src/services/*`.
- Contains: Auth providers/hooks, AI config provider, domain service classes.
- Depends on: `frontend/src/services/api.js` transport and backend route contracts.

**Backend API Layer:**
- Purpose: Endpoint definitions, request/response validation, authorization guards.
- Location: `backend/app/routers/*.py`.
- Contains: Auth, projects, articles, AI, and stats routes.
- Depends on: `backend/app/core/dependencies.py`, SQLAlchemy models/schemas, domain services.

**Backend Domain/Integration Layer:**
- Purpose: AI calls, embedding generation, RAG retrieval, graph synchronization.
- Location: `backend/app/services/*.py`.
- Contains: `ai_service.py`, `embedding_service.py`, `rag_service.py`, `graph_sync_service.py`, `neo4j_service.py`.
- Depends on: External providers and database connections from config.

**Persistence Layer:**
- Purpose: Data models, sessions, startup DB initialization and extension enablement.
- Location: `backend/app/models/*.py`, `backend/app/database.py`.
- Contains: SQLAlchemy models for users/projects/articles, vector field (`Vector(768)`) and table setup.

## Data and Control Flow

**Authenticated feature request flow:**
1. React route is matched in `frontend/src/App.jsx`; protected routes pass through `frontend/src/components/ProtectedRoute.jsx`.
2. Page logic invokes domain service (example: `frontend/src/pages/Dashboard.jsx` -> `frontend/src/services/statsService.js`).
3. Service calls `frontend/src/services/api.js`, which injects bearer token from localStorage.
4. FastAPI router handles endpoint (`backend/app/routers/stats.py`) and resolves dependencies (`backend/app/core/dependencies.py`).
5. Router executes SQL queries against models via async session (`backend/app/database.py`, `backend/app/models/*.py`).
6. Response JSON returns to UI for rendering.

**Article creation + enrichment flow:**
1. Frontend submits article payload through `frontend/src/services/artigosService.js`.
2. `backend/app/routers/articles.py` persists article and conditionally runs AI evaluation + embedding generation.
3. Router invokes graph sync (`backend/app/services/graph_sync_service.py`) to update Neo4j through `backend/app/services/neo4j_service.py`.
4. Stored metadata and relationship graph become available for later retrieval and visualizations.

**Project chat (RAG) flow:**
1. Frontend AI chat route calls backend AI endpoint (`frontend/src/App.jsx`, `frontend/src/services/api.js`).
2. `backend/app/routers/ai.py` invokes `backend/app/services/rag_service.py`.
3. RAG service computes query embedding, runs pgvector search on `articles.embedding`, and builds project-context payload.
4. AI service synthesizes final answer and router returns response with source articles.

## Key Modules and Responsibilities

**Application Bootstrap:**
- `backend/app/main.py`: FastAPI app creation, lifecycle startup/shutdown, CORS, router registration.
- `frontend/src/main.jsx`: React root and router initialization.

**Security and Identity:**
- `backend/app/core/security.py`: Password hashing/verification and JWT lifecycle.
- `backend/app/core/dependencies.py`: Authenticated user resolution and admin guard.
- `frontend/src/features/auth/context/AuthContext.jsx`: Client auth state persistence and token validation cycle.

**Domain Data Model:**
- `backend/app/models/project.py`: Project aggregate including framework configuration and screening criteria arrays.
- `backend/app/models/article.py`: Article metadata, PDF blob, AI annotations, vector embedding, self-referential relationships.

**Domain Endpoints:**
- `backend/app/routers/projects.py`: CRUD and framework metadata endpoints.
- `backend/app/routers/articles.py`: Article CRUD, status/notes updates, PDF upload/download, AI/graph sync trigger points.
- `backend/app/routers/ai.py`: Research question/search-string generation and chat endpoints.

## State Management

**Frontend state:**
- Context-based providers for auth and AI config (`frontend/src/features/auth/context/AuthContext.jsx`, `frontend/src/features/ai/context/AIConfigContext.jsx`).
- Route-level local state in pages (example: dashboard metrics and tabs in `frontend/src/pages/Dashboard.jsx`).

**Backend state:**
- Stateless request handlers with per-request DB sessions from `backend/app/database.py`.
- Service singletons for expensive integrations (`get_rag_service`, `get_neo4j_service` patterns in `backend/app/services/*.py`).

## Error Handling

**Strategy:** HTTP exceptions at router/dependency boundaries, generic exception wrapping for integration calls.

**Patterns:**
- Explicit domain error payloads in routers (`backend/app/routers/auth.py`, `backend/app/routers/projects.py`).
- Token/auth failures centralized in dependency layer (`backend/app/core/dependencies.py`).
- Integration exceptions caught and converted to `500`/`404` where applicable (`backend/app/routers/ai.py`, `backend/app/routers/articles.py`).

## Cross-Cutting Concerns

**Authentication:** JWT bearer token end-to-end (`frontend/src/services/api.js` -> `backend/app/core/dependencies.py`).

**Validation:**
- Request/response schemas in `backend/app/schemas/*.py`.
- Basic frontend pre-validation in service wrappers (`frontend/src/services/projetosService.js`, `frontend/src/services/artigosService.js`).

**Configuration:**
- Centralized runtime settings in `backend/app/config.py` and frontend env usage in `frontend/src/services/api.js`.

---

*Architecture analysis: 2026-03-27*
