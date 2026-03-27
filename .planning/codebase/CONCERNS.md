# Codebase Concerns

**Analysis Date:** 2026-03-27

## Critical

### 1) Hardcoded secrets and default credentials in tracked code
- Why it matters:
  - Enables unauthorized access if defaults are deployed or leaked.
  - Increases blast radius across database, graph store, and auth token signing.
- Evidence:
  - `backend/app/config.py` (default `JWT_SECRET`, `DATABASE_URL`, `NEO4J_PASSWORD`)
  - `docker-compose.yml` (`POSTGRES_PASSWORD=synapse`, `NEO4J_AUTH=neo4j/synapse123`)
  - `docker-compose-d.yml` (`POSTGRES_PASSWORD=synapse`)
- Suggested remediation direction:
  - Remove all credential defaults from committed config and require environment injection.
  - Rotate all known defaults immediately.
  - Enforce startup validation that rejects weak/default secrets in non-local environments.

### 2) Sensitive AI provider key persisted in browser localStorage
- Why it matters:
  - Keys in localStorage are readable by any injected script (XSS impact becomes account-level plus provider-billing impact).
  - Key material is copied into API requests from client state, expanding exposure surface.
- Evidence:
  - `frontend/src/context/aiConfigContext.jsx` (`geminiConfig.apiKey` persisted via `localStorage`)
  - `frontend/src/services/api.js` (`getAIConfig()` reads persisted key and appends to request payload)
- Suggested remediation direction:
  - Move provider key handling server-side with secrets in backend environment.
  - If per-user keys are required, store encrypted at rest server-side and never in browser persistent storage.
  - Add CSP + XSS hardening as defense in depth.

## High

### 1) CPU-heavy embedding/model inference executed inline on async request path
- Why it matters:
  - Blocking CPU work in request handlers degrades latency and can starve the event loop under load.
  - First-request model load incurs large cold-start delays and memory spikes.
- Evidence:
  - `backend/app/services/embedding_service.py` (`AutoModel.from_pretrained` lazy load; sync `generate_embedding`)
  - `backend/app/routers/articles.py` (calls `embedding_service.generate_embedding(...)` during create/reprocess flows)
  - `backend/app/services/rag_service.py` (query embedding generated in request path)
- Suggested remediation direction:
  - Offload embedding/inference to background workers (queue-based jobs).
  - Pre-warm model at service startup or isolate in dedicated inference service.
  - Add request timeouts and circuit-breakers for AI-dependent paths.

### 2) No automated tests and no CI workflow detected
- Why it matters:
  - Regressions are likely to reach production undetected.
  - Delivery speed slows due to manual verification burden.
- Evidence:
  - No test files found under backend/frontend source patterns.
  - No `.github/workflows/` pipeline detected.
  - `backend/requirements.txt` includes pytest dependencies, but no runnable suite/config found.
- Suggested remediation direction:
  - Add baseline unit tests for auth, project/article routers, and AI service adapters.
  - Add integration tests for critical API flows.
  - Add CI (lint + test + build) on pull requests.

### 3) DB schema management mixed into runtime startup instead of migration workflow
- Why it matters:
  - Runtime DDL can cause startup failures or drift across environments.
  - Operational behavior becomes non-deterministic when schema changes and app deploys are coupled.
- Evidence:
  - `backend/app/database.py` (`Base.metadata.create_all`, extension creation, and `ALTER TABLE` in `init_db()`)
  - `backend/requirements.txt` includes Alembic, but startup code still applies schema changes directly.
- Suggested remediation direction:
  - Move all schema changes to versioned Alembic migrations.
  - Restrict startup to health checks and connectivity verification only.

### 4) Environment drift and stale operational documentation
- Why it matters:
  - Onboarding and deployment errors increase when docs/infrastructure instructions do not match the running stack.
  - Debugging time increases due to contradictory setup guidance.
- Evidence:
  - `readme.md` references Node/Express/Mongo stack not matching actual FastAPI/PostgreSQL/Neo4j codebase.
  - `docker-compose-d.yml` frontend build path points to `./synapse` while repository contains `frontend/`.
- Suggested remediation direction:
  - Update README to current architecture and commands.
  - Validate compose files in CI (`docker compose config` + smoke startup).
  - Keep one source of truth for local/dev/prod runtime instructions.

## Medium

### 1) Large, multi-responsibility modules increase change risk
- Why it matters:
  - Large files are harder to reason about and test, increasing defect probability in routine edits.
  - Domain logic, orchestration, and transport concerns are tightly coupled.
- Evidence:
  - `backend/app/routers/articles.py` (~584 lines)
  - `backend/app/services/ai_service.py` (~374 lines)
  - `frontend/src/features/projects/components/PlanejamentoProjeto.jsx` (~528 lines)
  - `frontend/src/features/articles/components/GrafoArtigos.jsx` (~390 lines)
- Suggested remediation direction:
  - Split by capability (query handlers, orchestration services, prompt builders, UI subcomponents).
  - Introduce thin route handlers with testable service boundaries.

### 2) Duplicate/overlapping article hook paths suggest drift risk
- Why it matters:
  - Parallel implementations tend to diverge and create inconsistent behavior across pages/features.
  - Bug fixes may be applied in one path and missed in another.
- Evidence:
  - `frontend/src/hooks/useArtigos.js`
  - `frontend/src/features/articles/hooks/useArtigos.js`
- Suggested remediation direction:
  - Consolidate into one canonical hook module and re-export where needed.
  - Add tests around filtering/debounce behavior before consolidation.

### 3) Extensive `print`-based logging in backend paths
- Why it matters:
  - Lacks structured fields, log levels, and correlation IDs needed for production diagnosis.
  - Can leak internal details and creates noisy, inconsistent observability.
- Evidence:
  - `backend/app/routers/articles.py` (many `[GRAPH]`/`[REPROCESS]` prints)
  - `backend/app/services/embedding_service.py` (model-load prints)
  - `backend/app/services/graph_sync_service.py` (relationship/embedding prints)
- Suggested remediation direction:
  - Replace prints with structured logging (JSON format, levels, request correlation).
  - Standardize error logging policy and redact sensitive payloads.

---

*Concerns audit: 2026-03-27*
