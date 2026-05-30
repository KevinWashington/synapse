# Synapse — AGENTS.md

## Project structure

```
backend/     Python FastAPI (async) — PostgreSQL + Neo4j + Qdrant
frontend/    React 19 + Vite 7 + JSX + Tailwind CSS v4
docker-compose.yml  orchestrates all services
```

## Backend commands (run from `backend/`)

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 5000
```

- Config via `backend/.env` (see `.env.example`). **Required**: `DEEPSEEK_API_KEY`, `HF_TOKEN` — validated on startup, will crash without them.
- DB migrations happen automatically on startup in `app/database.py` (no Alembic).
- Tests: `pytest` (no real DB needed — conftest.py provides stubs for AI/vector/graph modules).
- Test quirks: uses monkeypatching + module stubs; run from `backend/` dir.

## Frontend commands (run from `frontend/`)

```bash
npm run dev      # Vite dev server on :3000
npm run build    # production build
npm run lint     # ESLint
```

- **JavaScript, NOT TypeScript** — despite `tsconfig.json` and `components.json` saying `"tsx": true`.
- Path aliases: `@/` → `src/`, `@components/`, `@features/`, `@hooks/`, `@services/`.
- Styling: Tailwind only (no external CSS, no styled-components).
- JWT token stored in `localStorage("token")`, sent as `Authorization: Bearer <token>`.
- `VITE_API_URL` defaults to `http://localhost:5000`.
- See `frontend/CONVENTIONS.md` for full component/hook/naming conventions (Portuguese).

## Docker Compose

```bash
docker compose up -d
```

Starts: postgres (pgvector/pg16), neo4j (5-community), qdrant, qdrant-init (one-shot), backend (FastAPI on :5000), frontend (Vite dev on :3000).

## Key architecture notes

- **Three databases**: PostgreSQL (articles/projects/users, asyncpg + pgvector), Neo4j (graph relationships), Qdrant (semantic vector search, 768-dim SPECTER2).
- **AI stack**: LangChain + DeepSeek (`ChatOpenAI` with DeepSeek's OpenAI-compatible API). No local LLM.
- **MCP-host pattern**: `MCPHostService` orchestrates tool calls to qdrant/neo4j/postgres "servers" at startup.
- **Auth**: JWT (HS256, 7-day expiry), bcrypt with SHA256 prehash (avoids 72-byte bcrypt limit).
- **Router prefixes**: `/api/auth`, `/api/projetos`, `/api` (AI + stats).
- **API language**: Portuguese (error messages, descriptions, comments in backend router code).
- **Research frameworks**: PICO, PICOS, PECO, PICOC — defined in `backend/app/frameworks.py`.

## Conventions

- Frontend: single component per file, PascalCase filename, index.js for re-exports only, max ~150 lines per component.
- Backend: SQLAlchemy model column names in camelCase (e.g. `ownerId`, `paperId`, `createdAt`).
- Git ignores `.github/`, `.agents/`, `.codex/`, `.planning/*`, `*.env`.
