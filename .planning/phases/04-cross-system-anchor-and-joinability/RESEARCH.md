# Phase 04 Research Summary

## Decision Summary
Use a deterministic canonical `paper_id` strategy with centralized normalization/generation logic, then enforce it at relational write boundaries and vector payload boundaries.

## Why This Approach
- Prevents drift between DB primary keys and external anchoring identifiers.
- Enables safe migration: backfill existing rows while requiring canonical anchor for new/updated records.
- Supports future provenance and graph/vector fusion by providing a stable cross-store join key.

## Required Characteristics
- Canonical `paper_id` normalization rules are centralized in one service.
- PostgreSQL records persist `paper_id` with project-aware uniqueness safeguards.
- Qdrant payload contract always includes `paper_id` and `project_id`.
- Diagnostics can detect anchor mismatch or missing anchors.

## Validation Intent
- Plan tasks require compile checks and grep-verifiable `paper_id` usage in model/schema/service layers.
- Final diagnostics endpoint reports cross-system anchor joinability signals.
