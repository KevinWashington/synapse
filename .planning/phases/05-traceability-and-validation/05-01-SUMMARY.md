# 05-01 Summary

## Plan
Define provenance contracts in schema and retrieval boundaries.

## Completed
- Extended `backend/app/schemas/ai.py` with source-level `paperId`/`provenance` fields and `ChatProvenance` in `ProjectChatResponse`.
- Updated `backend/app/services/rag_service.py` to emit normalized provenance metadata for all retrieval paths.
- Updated `backend/app/services/qdrant_retrieval_service.py` to include provenance markers in upsert payload and anchor inspection output.

## Verification
- `python -m compileall backend/app/schemas/ai.py backend/app/services/rag_service.py backend/app/services/qdrant_retrieval_service.py` passed.

## Outcome
Phase 5 now has an explicit provenance contract from retrieval services through API schemas.
