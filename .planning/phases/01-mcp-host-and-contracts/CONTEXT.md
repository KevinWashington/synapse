# Phase 01 Context: MCP Host and Contracts

## Goal
Establish a stable local MCP host orchestration layer and explicit JSON-RPC contracts that all project MCP servers follow.

## Inputs
- .planning/PROJECT.md
- .planning/REQUIREMENTS.md (R1)
- .planning/ROADMAP.md (Phase 1)
- Existing backend service and router patterns under backend/app

## Scope Boundaries
- In scope: contract definition, orchestrator structure, registration/discovery, health/diagnostic behavior.
- Out of scope: advanced multi-step planning logic, ranking strategies, and domain-specific reasoning loops.

## Risk Focus
- Contract ambiguity between host and servers
- Weak failure diagnostics when a server is unavailable
- Coupling host orchestration to one provider or one retrieval path

## Definition of Ready
- Plans include concrete file targets and acceptance criteria.
- Verification steps are executable through existing test/lint pipeline or script checks.
