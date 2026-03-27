# REQUIREMENTS

## Milestone 1: Hybrid GraphRAG Foundation

### R1 - Local MCP host orchestration
- Host orchestrator can connect to all configured local MCP servers via JSON-RPC.
- Failures are surfaced with actionable diagnostics.

### R2 - Vector search server with project isolation
- Qdrant-backed semantic search server is operational.
- `project_id` filtering is mandatory at protocol/tool boundary.
- Specter2 embeddings are supported for retrieval.

### R3 - Graph and SQL MCP foundations
- Neo4j MCP server supports core read/write operations.
- PostgreSQL MCP server supports core read/write operations.
- Basic health checks validate both servers.

### R4 - Universal anchor key consistency
- `paper_id` exists in Qdrant payload records.
- `paper_id` exists as canonical key in PostgreSQL records.
- Cross-system joins are feasible through `paper_id`.

### R5 - Source traceability
- Responses include source context that indicates which subsystem contributed evidence (vector, graph, SQL).
- System can expose retrieval provenance for auditing.

### R6 - Security and isolation guarantees
- Cross-project data access is prevented by design.
- Isolation policy is validated in integration tests.

## Out of Scope (Milestone 1)
- Full autonomous multi-step agent planning for all query classes
- Advanced graph reasoning optimization and ranking experimentation
- Enterprise multi-tenant remote deployment
