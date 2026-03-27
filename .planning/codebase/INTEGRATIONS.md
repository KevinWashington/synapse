# External Integrations

**Analysis Date:** 2026-03-27

## Service Boundaries

**First-party boundaries:**
- Frontend SPA (`frontend/src/**`) communicates only with backend HTTP API through `apiService` in `frontend/src/services/api.js`
- Backend API (`backend/app/routers/*.py`) orchestrates database, graph, and AI integrations
- Data/AI side effects are concentrated in `backend/app/services/*.py`

**Third-party boundaries:**
- Google Gemini via LangChain client in `backend/app/services/ai_service.py`
- Hugging Face model distribution for SPECTER2 in `backend/app/services/embedding_service.py`
- PostgreSQL + pgvector in `backend/app/database.py`, `backend/app/services/rag_service.py`
- Neo4j graph database in `backend/app/services/neo4j_service.py`

## APIs and External Services

**AI inference:**
- Google Gemini API - Text generation/evaluation and chat workflows
  - Client SDK: `langchain-google-genai` + `langchain-core` (`backend/requirements.txt`, `backend/app/services/ai_service.py`)
  - Auth input: `GOOGLE_API_KEY` from backend settings model (`backend/app/config.py`)
  - Entry points: `/api/generate-research-questions`, `/api/generate-search-strings`, `/api/generate-criteria`, `/api/chat`, `/api/project-chat` in `backend/app/routers/ai.py`

**Local AI provider config (UI-facing):**
- Ollama endpoint and model are captured in client config state (`frontend/src/context/aiConfigContext.jsx`) and forwarded in payload metadata by `frontend/src/services/api.js`
- Current backend AI implementation path uses Gemini service classes directly (`backend/app/services/ai_service.py`)

**Model artifact registry:**
- Hugging Face Hub (`allenai/specter2_base`) model/tokenizer downloads at runtime in `backend/app/services/embedding_service.py`

## Data Storage Integrations

**PostgreSQL (primary transactional store):**
- Connectivity key: `DATABASE_URL` in `backend/app/config.py`
- Driver stack: `sqlalchemy[asyncio]` + `asyncpg` (`backend/requirements.txt`)
- Operational usage: entity CRUD in routers/models, startup initialization in `backend/app/database.py`

**pgvector extension (semantic retrieval):**
- Extension bootstrap: `CREATE EXTENSION IF NOT EXISTS vector` in `backend/app/database.py`
- Vector similarity query: `<=>` cosine distance in `backend/app/services/rag_service.py`

**Neo4j (graph relationships):**
- Connectivity keys: `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` (`backend/app/config.py`)
- Driver/API: `neo4j.AsyncGraphDatabase` (`backend/app/services/neo4j_service.py`)
- Sync integration point: article create/update flows trigger graph sync in `backend/app/routers/articles.py`, `backend/app/services/graph_sync_service.py`

## Authentication and Authorization Integration

**Auth provider:**
- Custom JWT auth in backend
  - Token issue/verify: `backend/app/core/security.py`
  - Request guard: `HTTPBearer` dependency in `backend/app/core/dependencies.py`

**Frontend auth integration:**
- Token storage and injection into `Authorization: Bearer` header in `frontend/src/services/api.js`
- 401 handling clears local session state in `frontend/src/services/api.js`

## Configuration and Environment Dependencies

**Backend-required config keys:**
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_ALGORITHM`
- `JWT_EXPIRE_MINUTES`
- `GOOGLE_API_KEY`
- `NEO4J_URI`
- `NEO4J_USER`
- `NEO4J_PASSWORD`
- `PORT`
- `DEBUG`

Source of truth: `backend/app/config.py`; compose injects values via `environment` and `env_file` in `docker-compose.yml`, `docker-compose-d.yml`.

**Frontend-required config keys:**
- `VITE_API_URL` (optional override) in `frontend/src/services/api.js`

**Secret storage location:**
- `backend/.env` present (environment configuration file)
- `backend/.env.example` provides key placeholders

## CI/CD and Deployment Integrations

**Hosting/deployment shape currently represented:**
- Docker Compose-managed services (`backend`, `frontend`, `postgres`, `neo4j`, optional `ollama`) in `docker-compose.yml`, `docker-compose-d.yml`

**CI pipeline:**
- Not detected (`.github/workflows/` not present)

## Webhooks and Callbacks

**Incoming webhooks:**
- Not detected

**Outgoing callbacks/webhooks:**
- Not detected

## Integration Failure Points and Operational Risks

**Gemini key/config failure:**
- Trigger: missing or invalid `GOOGLE_API_KEY`
- Surface: AI endpoints return backend 500 with provider exception bubbling from `backend/app/routers/ai.py`
- Mitigation path: startup config validation and provider health checks are not present

**Neo4j availability mismatch:**
- Trigger: backend runs without `neo4j` service (not present in `docker-compose-d.yml`) while graph sync is attempted in article creation flow
- Surface: exception logging during graph sync in `backend/app/routers/articles.py`
- Mitigation path: conditional graph feature toggle and retry/backoff not currently implemented

**Cold-start ML latency/memory pressure:**
- Trigger: first embedding request lazy-loads tokenizer/model from hub in `backend/app/services/embedding_service.py`
- Surface: elevated first-request latency and possible resource spikes
- Mitigation path: warmup/preload and model cache strategy not currently wired

**Frontend-backend URL drift:**
- Trigger: incorrect `VITE_API_URL` or missing network route
- Surface: client-side connection errors in `frontend/src/services/api.js`
- Mitigation path: no environment validation screen; errors handled at request time only

**Auth token lifecycle edge cases:**
- Trigger: expired or malformed JWT
- Surface: 401 from guarded endpoints (`backend/app/core/dependencies.py`) and forced logout in `frontend/src/services/api.js`
- Mitigation path: no refresh-token integration detected

---

*Integration audit: 2026-03-27*
