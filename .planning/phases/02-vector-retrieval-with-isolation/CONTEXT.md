# Phase 02 Context: Vector Retrieval with Isolation

## Goal
Implement and enforce project-isolated semantic retrieval with a clear migration path to Qdrant-backed retrieval.

## Inputs
- .planning/PROJECT.md
- .planning/REQUIREMENTS.md (R2, R6)
- .planning/ROADMAP.md (Phase 2)
- Current retrieval implementation in `backend/app/services/rag_service.py`

## Current Baseline
- Retrieval currently uses pgvector SQL query in PostgreSQL.
- Query already filters by `projectId`, but owner-scoped enforcement and contract-level guarantees need hardening.
- API entrypoint is `/api/project-chat` via `backend/app/routers/ai.py`.

## Risk Focus
- Cross-project leakage from missing ownership checks.
- Inconsistent enforcement between retrieval service and API layer.
- Drift between current pgvector path and target Qdrant path.
