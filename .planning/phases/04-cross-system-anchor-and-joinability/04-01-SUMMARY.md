# 04-01 Summary

## Plan
Establish canonical `paper_id` foundation in relational model/schema/database.

## Completed
- Added `paperId` to Article model and project-aware index in `backend/app/models/article.py`.
- Added migration/backfill logic for `paperId` plus indexes in `backend/app/database.py`.
- Added deterministic anchor normalization/generation service in `backend/app/services/anchor_service.py`.
- Added `paperId` fields in create/update/response schemas in `backend/app/schemas/article.py`.

## Verification
- `python -m compileall` passed for model/database/anchor/schema files.
- Editor diagnostics report no errors.

## Outcome
PostgreSQL now has a canonical paper anchor contract ready for cross-system joins.
