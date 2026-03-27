# ROADMAP

## Current Milestone

Milestone 1 - Hybrid GraphRAG Foundation

### Phase 1: MCP Host and Contracts

**Goal:** Establish stable local MCP host orchestration and server contracts.
**Requirements:** R1
**Plans:** 3 plans

Plans:

- [x] 01-01-PLAN.md - Define JSON-RPC contracts and host config
- [x] 01-02-PLAN.md - Implement MCP host orchestration service
- [x] 01-03-PLAN.md - Add diagnostics and operations documentation

### Phase 2: Vector Retrieval with Isolation

**Goal:** Implement Qdrant semantic retrieval with mandatory project-level isolation.
**Requirements:** R2, R6
**Depends on:** Phase 1
**Plans:** 3 plans

Plans:

- [x] 02-01-PLAN.md - Harden owner and project scope checks
- [x] 02-02-PLAN.md - Add Qdrant adapter with mandatory project filter
- [x] 02-03-PLAN.md - Add isolation diagnostics and negative-path checks

### Phase 3: Graph and SQL MCP Foundations

**Goal:** Add baseline Neo4j and PostgreSQL MCP servers with health checks.
**Requirements:** R3
**Depends on:** Phase 1
**Plans:** 3 plans

Plans:

- [x] 03-01-PLAN.md - Add Neo4j MCP read/write and health contracts
- [x] 03-02-PLAN.md - Add PostgreSQL MCP read/write and health service
- [x] 03-03-PLAN.md - Wire graph/sql MCP startup and diagnostics

### Phase 4: Cross-System Anchor and Joinability

**Goal:** Enforce `paper_id` consistency across vector and relational stores.
**Requirements:** R4
**Depends on:** Phase 2, Phase 3
**Plans:** 3 plans

Plans:

- [x] 04-01-PLAN.md - Add canonical paperId contract to relational records
- [x] 04-02-PLAN.md - Propagate paper_id through vector payload boundaries
- [x] 04-03-PLAN.md - Add anchor joinability diagnostics and checks

### Phase 5: Traceability and Validation

**Goal:** Expose provenance in outputs and verify isolation/traceability through tests.
**Requirements:** R5, R6
**Depends on:** Phase 2, Phase 3, Phase 4
**Plans:** 3 plans

Plans:

- [ ] 05-01-PLAN.md - Define provenance contracts in schema and retrieval layer
- [ ] 05-02-PLAN.md - Expose provenance and isolation audit data in APIs
- [ ] 05-03-PLAN.md - Add automated traceability and isolation tests

## Recommended Next Command

/gsd-execute-phase 5
