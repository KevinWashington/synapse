# Technology Stack

**Analysis Date:** 2026-03-27

## Languages

**Primary:**
- Python 3.12 - Backend API and AI/data services in `backend/app/main.py`, `backend/app/services/*.py`
- JavaScript (ES modules) - Frontend SPA and API client in `frontend/src/**/*.jsx`, `frontend/src/services/api.js`

**Secondary:**
- SQL (PostgreSQL + pgvector SQL) - Vector extension and similarity queries in `backend/app/database.py`, `backend/app/services/rag_service.py`
- Cypher (Neo4j) - Graph node/edge persistence in `backend/app/services/neo4j_service.py`
- YAML - Container topology and environment wiring in `docker-compose.yml`, `docker-compose-d.yml`

## Runtime

**Environment:**
- Backend runtime: Python 3.12 slim container in `backend/Dockerfile`
- Frontend runtime/build: Node.js 18 Alpine in `frontend/Dockerfile`, `frontend/Dockerfile.dev`
- Backend server: Uvicorn ASGI serving FastAPI app in `backend/Dockerfile`, `backend/app/main.py`
- Frontend dev server/build tool: Vite in `frontend/package.json`, `frontend/vite.config.js`

**Package Manager:**
- Frontend: npm (lockfile present at `frontend/package-lock.json`)
- Backend: pip via `requirements.txt` in `backend/requirements.txt` (no Python lockfile detected)

## Frameworks

**Core:**
- FastAPI 0.115.0 - HTTP API layer and routing in `backend/app/main.py`, `backend/app/routers/*.py`
- SQLAlchemy asyncio 2.0.36 - ORM/data access in `backend/app/database.py`, `backend/app/models/*.py`
- React 19.1.1 - Client UI runtime in `frontend/src/main.jsx`, `frontend/src/App.jsx`
- React Router DOM 7.9.1 - SPA routing in `frontend/src/App.jsx`

**AI/ML:**
- LangChain 0.3.x + langchain-google-genai 2.0.0 - LLM prompt chaining and Gemini calls in `backend/app/services/ai_service.py`
- transformers 4.48.0 + torch 2.6.0 + sentence-transformers 3.4.1 - Embeddings pipeline in `backend/app/services/embedding_service.py`

**Build/Dev:**
- Vite 7.1.2 + `@vitejs/plugin-react` - Frontend build and dev server in `frontend/package.json`, `frontend/vite.config.js`
- Tailwind CSS v4 (`@tailwindcss/vite`) - Styling pipeline in `frontend/package.json`, `frontend/vite.config.js`
- ESLint 9 - Linting in `frontend/package.json`, `frontend/eslint.config.js`
- Docker Compose - Local multi-service orchestration in `docker-compose.yml`, `docker-compose-d.yml`

## Key Dependencies

**Critical:**
- `fastapi`, `uvicorn[standard]` - API process lifecycle and request handling (`backend/requirements.txt`)
- `sqlalchemy[asyncio]`, `asyncpg` - PostgreSQL async connectivity (`backend/app/database.py`)
- `pgvector` - Embedding storage/search support (`backend/app/database.py`, `backend/app/services/rag_service.py`)
- `langchain-google-genai` - Google Gemini client integration (`backend/app/services/ai_service.py`)
- `neo4j` - Graph relationship persistence (`backend/app/services/neo4j_service.py`)

**Infrastructure/UI:**
- `python-jose[cryptography]`, `bcrypt` - JWT auth and password hashing (`backend/app/core/security.py`)
- `react-hook-form`, `zod` - Frontend validation/form workflows (`frontend/package.json`)
- Radix UI packages - UI primitives (`frontend/package.json`, `frontend/src/components/ui/*.tsx`)
- `recharts`, `react-force-graph-2d` - Visualization components (`frontend/package.json`)

## Runtime and Deployment Topology

**Local/container topology:**
- API service: `backend` on port 5000 (`docker-compose.yml`, `docker-compose-d.yml`)
- Frontend service: `frontend` on port 3000 in dev compose (`docker-compose-d.yml`)
- Primary relational store: `postgres` on port 5432 (`docker-compose.yml`, `docker-compose-d.yml`)
- Graph store: `neo4j` on ports 7474/7687 (`docker-compose.yml`)
- Optional local LLM infra profile: `ollama` on 11434 (`docker-compose-d.yml`)

**App wiring:**
- Frontend calls backend through `VITE_API_URL` fallback `http://localhost:5000` in `frontend/src/services/api.js`
- Backend enables CORS for local frontend origins in `backend/app/main.py`

## Data Stores

**Relational + vector:**
- PostgreSQL with async SQLAlchemy + pgvector extension initialized at startup in `backend/app/database.py`

**Graph:**
- Neo4j async driver for article relationship graph in `backend/app/services/neo4j_service.py`, `backend/app/services/graph_sync_service.py`

**Client-side state/cache:**
- Browser localStorage for auth token/user and AI provider config in `frontend/src/services/api.js`, `frontend/src/context/aiConfigContext.jsx`

## Configuration

**Environment-driven config:**
- Backend settings model in `backend/app/config.py` with keys including `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_API_KEY`, `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`, `PORT`, `DEBUG`
- Compose injects backend env and references `backend/.env` via `env_file` in `docker-compose.yml`, `docker-compose-d.yml`
- Frontend runtime base URL configured by `VITE_API_URL` in `frontend/src/services/api.js`

**Build config files:**
- `frontend/vite.config.js`
- `frontend/eslint.config.js`
- `frontend/tsconfig.json`
- `docker-compose.yml`
- `docker-compose-d.yml`

## Platform Requirements

**Development:**
- Docker Engine + Docker Compose for full-stack local environment (`docker-compose.yml`, `docker-compose-d.yml`)
- Node.js 18+ for frontend local dev (`frontend/package.json`, `frontend/Dockerfile.dev`)
- Python 3.12 + pip for backend local runtime parity (`backend/Dockerfile`)

**Production-style path currently implied by repo:**
- Containerized deployment with independent backend/frontend services and managed PostgreSQL + optional Neo4j service endpoints
- No CI/CD workflow files detected in `.github/workflows/`

---

*Stack analysis: 2026-03-27*
