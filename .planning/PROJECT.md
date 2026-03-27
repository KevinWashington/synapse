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

## Scope Baseline (Milestone 1)
- Local MCP host orchestration using JSON-RPC
- Qdrant vector search server with Specter2 embeddings
- Mandatory project-level filtering for vector retrieval
- Basic Neo4j and PostgreSQL MCP servers for read/write operations
- Universal paper anchor key (`paper_id`) consistency across stores

## Success Criteria
- Retrieval and reasoning path can be traced to concrete sources and systems
- No cross-project data leakage in retrieval results
- Multi-tool reasoning improves answer quality over vector-only baseline
- Foundation is stable for later advanced reactive loops
