# PROJECT

## Name
Hybrid GraphRAG with Reactive Agents and MCP

## Vision
Evolve a static, vector-only RAG system into a Hybrid GraphRAG architecture powered by reactive agents and MCP so the platform can answer complex scientific questions with high precision and source traceability.

## Primary Outcome
A local agent orchestration layer that can dynamically combine:
- semantic vector retrieval (Qdrant)
- knowledge graph expansion (Neo4j)
- metadata validation (PostgreSQL)

while maintaining strict per-project data isolation.

## Primary Users
- Scientific researchers and systematic reviewers
- Bioinformatics and research data scientists
- Project investigators and research orchestrators

## User Pain Points
- Information silos between vector, graph, and relational systems
- Hallucination risk in specialized scientific domains
- Weak source traceability for generated answers
- Rigid, one-size-fits-all retrieval pipelines
- Data isolation risk across concurrent projects


<details>
<summary>Milestone 1 (v1.0) — Hybrid GraphRAG Foundation (archived)</summary>

<b>Scope Baseline:</b>
- Local MCP host orchestration using JSON-RPC
- Qdrant vector search server with Specter2 embeddings
- Mandatory project-level filtering for vector retrieval
- Basic Neo4j and PostgreSQL MCP servers for read/write operations
- Universal paper anchor key (`paper_id`) consistency across stores

<b>Success Criteria:</b>
- Retrieval and reasoning path can be traced to concrete sources and systems
- No cross-project data leakage in retrieval results
- Multi-tool reasoning improves answer quality over vector-only baseline
- Foundation is stable for later advanced reactive loops

</details>

## Current State (after v1.0)

- All core retrieval, graph, and SQL MCP services operational and integrated
- Project-level isolation and provenance contracts enforced
- Automated tests and diagnostics cover all requirements
- Foundation ready for advanced agent orchestration and multi-tenant expansion

## Next Milestone Goals

- Add multi-tenant remote deployment support
- Integrate advanced graph reasoning and ranking
- Expand agent orchestration for multi-step query planning
- Enhance diagnostics and auditability for production

---
*Last updated: 2026-03-27 after v1.0 milestone*
