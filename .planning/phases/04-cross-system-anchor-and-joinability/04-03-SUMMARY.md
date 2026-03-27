# 04-03 Summary

## Plan
Add anchor joinability diagnostics and project-scoped lookup helpers.

## Completed
- Added relational helpers `lookup_by_paper_id` and `paper_id_counts` in `backend/app/services/postgres_mcp_service.py`.
- Added vector anchor inspection helper in `backend/app/services/qdrant_retrieval_service.py`.
- Added diagnostics endpoint `GET /api/stats/anchor-consistency` in `backend/app/routers/stats.py`.

## Verification
- `python -m compileall` passed for postgres/qdrant/stats files.
- Editor diagnostics report no errors.

## Outcome
Operators can now inspect project-level anchor consistency between relational and vector boundaries.
