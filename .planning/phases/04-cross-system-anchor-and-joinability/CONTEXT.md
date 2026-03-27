# Phase 04 Context: Cross-System Anchor and Joinability

## Goal
Enforce a canonical `paper_id` across relational and vector stores so cross-system joins are deterministic and auditable.

## Inputs
- .planning/PROJECT.md
- .planning/REQUIREMENTS.md (R4)
- .planning/ROADMAP.md (Phase 4)
- Existing article model and APIs under backend/app/models and backend/app/routers/articles.py
- Existing retrieval adapter under backend/app/services/qdrant_retrieval_service.py

## Current Baseline
- PostgreSQL records are keyed by internal numeric `id` and do not expose canonical `paper_id`.
- Qdrant retrieval adapter exists as placeholder and does not yet enforce or expose `paper_id` payload usage.
- RAG retrieval path returns article metadata without explicit cross-system anchor traceability.

## Risk Focus
- Inconsistent or missing `paper_id` generation leads to unjoinable records.
- Vector payloads can diverge from relational identity if anchor mapping is implicit.
- No operational check currently verifies anchor consistency across systems.
