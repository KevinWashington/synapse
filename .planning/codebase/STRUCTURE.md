# Codebase Structure

**Analysis Date:** 2026-03-27

## Directory Layout

```text
synapse/
├── backend/                    # FastAPI application and domain services
│   ├── app/
│   │   ├── main.py             # API bootstrap and router mounting
│   │   ├── config.py           # Runtime configuration
│   │   ├── database.py         # Async DB engine/session and init
│   │   ├── core/               # Security and request dependencies
│   │   ├── models/             # SQLAlchemy entities
│   │   ├── schemas/            # Pydantic request/response contracts
│   │   ├── routers/            # HTTP endpoint modules
│   │   └── services/           # AI, embedding, RAG, and graph integrations
│   └── requirements.txt        # Python dependencies
├── frontend/                   # Vite + React client application
│   ├── src/
│   │   ├── main.jsx            # React bootstrap
│   │   ├── App.jsx             # Route tree and providers
│   │   ├── pages/              # Route-level screens
│   │   ├── features/           # Feature-scoped modules (auth, ai, articles, projects)
│   │   ├── services/           # API wrappers and domain service classes
│   │   ├── components/         # Shared UI and layout components
│   │   ├── context/            # Cross-page context providers
│   │   └── lib/                # Framework config and shared utilities
│   ├── vite.config.js          # Vite config and path alias
│   └── package.json            # Node scripts/dependencies
├── docker-compose.yml          # Multi-service local orchestration
├── docker-compose-d.yml        # Alternate compose profile
└── .planning/codebase/         # Generated architecture mapping docs
```

## Module Purpose Table

| Module Area | Purpose | Primary Files |
| --- | --- | --- |
| Backend bootstrap | Create app, lifecycle hooks, CORS, route registration | `backend/app/main.py` |
| Backend security | Password/JWT and user authorization dependencies | `backend/app/core/security.py`, `backend/app/core/dependencies.py` |
| Backend data access | Async engine/session and model base/init | `backend/app/database.py` |
| Backend domain models | Persistent entities and relationships | `backend/app/models/user.py`, `backend/app/models/project.py`, `backend/app/models/article.py` |
| Backend API routes | Endpoint handlers per domain | `backend/app/routers/auth.py`, `backend/app/routers/projects.py`, `backend/app/routers/articles.py`, `backend/app/routers/ai.py`, `backend/app/routers/stats.py` |
| Backend service integrations | AI generation, embeddings, retrieval, graph sync | `backend/app/services/ai_service.py`, `backend/app/services/embedding_service.py`, `backend/app/services/rag_service.py`, `backend/app/services/graph_sync_service.py`, `backend/app/services/neo4j_service.py` |
| Frontend bootstrap/routing | Mount app and define route tree | `frontend/src/main.jsx`, `frontend/src/App.jsx` |
| Frontend auth gating | Context + protected route control | `frontend/src/features/auth/context/AuthContext.jsx`, `frontend/src/components/ProtectedRoute.jsx` |
| Frontend page composition | Dashboard/projects/articles/chat/settings route screens | `frontend/src/pages/Dashboard.jsx`, `frontend/src/pages/Projetos.jsx`, `frontend/src/pages/Artigos.jsx`, `frontend/src/pages/ChatIA.jsx` |
| Frontend API transport | Base HTTP client, token injection, error normalization | `frontend/src/services/api.js` |
| Frontend domain services | Per-domain API wrappers for projects/articles/auth/stats | `frontend/src/services/projetosService.js`, `frontend/src/services/artigosService.js`, `frontend/src/services/authService.js`, `frontend/src/services/statsService.js` |

## Key Entrypoints

**Backend Entrypoints:**
- `backend/app/main.py`: Runtime entrypoint for `uvicorn` and API mounting.
- `backend/app/main.py` lifespan: calls `init_db` in `backend/app/database.py` on startup.

**Frontend Entrypoints:**
- `frontend/src/main.jsx`: Root render with `BrowserRouter`.
- `frontend/src/App.jsx`: Top-level providers (`AuthProvider`, `AIConfigProvider`) and route tree.

**Container Entrypoints:**
- `docker-compose.yml`: Defines local service topology.
- `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/Dockerfile.dev`: Build/runtime container boundaries.

## Directory Purposes

**backend/app/core:**
- Purpose: Shared request-time auth/security primitives.
- Contains: JWT/password helpers and dependency injectors.
- Key coupling: Imported by all protected routers.

**backend/app/routers:**
- Purpose: HTTP handlers grouped by business capability.
- Contains: Auth, projects, articles, AI, stats handlers.
- Key coupling: Depends on models, schemas, dependencies, and services.

**backend/app/services:**
- Purpose: Integration-heavy orchestration outside route handlers.
- Contains: AI, embeddings, vector retrieval, graph sync/Neo4j operations.
- Key coupling: Called from routers; some services call each other (graph sync -> neo4j, rag -> embedding).

**frontend/src/features:**
- Purpose: Feature-scoped exports and local organization.
- Contains: Auth and AI modular exports; other domains follow feature grouping.
- Key coupling: Re-export contracts consumed by `frontend/src/App.jsx` and pages.

**frontend/src/services:**
- Purpose: Client-side adaptation layer for REST endpoints.
- Contains: Class-based wrappers over `apiService`.
- Key coupling: Shared `apiService` is a central dependency for all domain calls.

## Naming and Organization Conventions

**Backend:**
- Files are snake_case modules (`graph_sync_service.py`, `dependencies.py`).
- Route files map to API domains (`projects.py`, `articles.py`, `auth.py`).

**Frontend:**
- Components/pages commonly use PascalCase filenames (`Dashboard.jsx`, `ProtectedRoute.jsx`).
- Service files use lower camel-like domain names + `Service` suffix (`projetosService.js`, `statsService.js`).
- Path alias `@` maps to `frontend/src` (`frontend/vite.config.js`, `frontend/tsconfig.json`).

## Notable Coupling Points

**Auth token coupling (frontend <-> backend):**
- Frontend stores token/user in localStorage (`frontend/src/features/auth/context/AuthContext.jsx`).
- `frontend/src/services/api.js` injects bearer token.
- Backend validates token and loads user in `backend/app/core/dependencies.py`.

**Route prefix coupling:**
- Frontend service endpoints assume backend prefixes from `backend/app/main.py`.
- Example: `frontend/src/services/projetosService.js` depends on `/api/projetos` path mounted in backend.

**Data-shape coupling between JS and Pydantic models:**
- Frontend project/article payload keys map directly to backend schema expectations (`frontend/src/services/projetosService.js`, `backend/app/schemas/project.py`; `frontend/src/services/artigosService.js`, `backend/app/schemas/article.py`).

**AI and graph workflow coupling inside article lifecycle:**
- Article creation/update in `backend/app/routers/articles.py` triggers AI evaluation, embedding generation, and graph sync.
- Graph sync depends on both embeddings and Neo4j service contracts (`backend/app/services/graph_sync_service.py`, `backend/app/services/neo4j_service.py`).

## Where to Add New Code

**New backend API capability:**
- Endpoint module: `backend/app/routers/`.
- Request/response schema: `backend/app/schemas/`.
- Persisted data: `backend/app/models/`.
- Integration/business orchestration: `backend/app/services/`.

**New frontend route-based feature:**
- Screen/page: `frontend/src/pages/` or `frontend/src/features/<domain>/pages/`.
- Service wrapper: `frontend/src/services/` or `frontend/src/features/<domain>/services/`.
- Route registration: `frontend/src/App.jsx`.

**New shared UI primitive:**
- Place in `frontend/src/components/ui/`.
- Reusable layout blocks in `frontend/src/components/layout/`.

---

*Structure analysis: 2026-03-27*
