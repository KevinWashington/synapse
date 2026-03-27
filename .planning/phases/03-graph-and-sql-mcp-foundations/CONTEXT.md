# Phase 03 Context: Graph and SQL MCP Foundations

## Goal
Add baseline Neo4j and PostgreSQL MCP server capabilities with explicit read/write contracts and health checks.

## Inputs
- .planning/PROJECT.md
- .planning/REQUIREMENTS.md (R3)
- .planning/ROADMAP.md (Phase 3)
- Existing graph integration in backend/app/services/neo4j_service.py
- Existing async SQL session infrastructure in backend/app/database.py

## Scope Boundaries
- In scope: MCP-oriented service contracts for graph and SQL, host registration, health diagnostics.
- Out of scope: cross-system paper_id joins and full GraphRAG orchestration loops.

## Risk Focus
- Missing protocol alignment between MCP host and graph/sql services
- Unsafe SQL execution surface for write operations
- Lack of operational health signals for graph/sql dependencies
