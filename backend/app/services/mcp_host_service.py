from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from app.config import settings
from app.schemas.ai import MCPError, MCPRequestEnvelope, MCPResponseEnvelope
from app.services.neo4j_service import get_neo4j_service
from app.services.postgres_mcp_service import get_postgres_mcp_service
from app.services.qdrant_retrieval_service import get_qdrant_retrieval_service


@dataclass
class MCPServerRegistration:
    name: str
    capabilities: list[str]
    healthy: bool = True
    last_error: dict | None = None


class MCPHostService:
    """In-process MCP host orchestration for local server dispatch and diagnostics."""

    def __init__(
        self,
        timeout_seconds: int | None = None,
        max_retries: int | None = None,
        protocol_version: str | None = None,
    ):
        self.timeout_seconds = timeout_seconds or settings.MCP_REQUEST_TIMEOUT_SECONDS
        self.max_retries = max_retries if max_retries is not None else settings.MCP_MAX_RETRIES
        self.protocol_version = protocol_version or settings.MCP_PROTOCOL_VERSION
        self._servers: dict[str, MCPServerRegistration] = {}

    def register_server(self, name: str, capabilities: list[str]) -> None:
        self._servers[name] = MCPServerRegistration(name=name, capabilities=capabilities)

    def set_server_health(self, name: str, healthy: bool, last_error: dict | None = None) -> None:
        server = self._servers.get(name)
        if server is None:
            return
        server.healthy = healthy
        server.last_error = last_error

    def get_server_for_method(self, method: str) -> MCPServerRegistration | None:
        for server in self._servers.values():
            if method in server.capabilities:
                return server
        return None

    async def dispatch(self, envelope: MCPRequestEnvelope) -> MCPResponseEnvelope:
        server = self.get_server_for_method(envelope.method)
        if server is None:
            error = self._build_error(
                code=-32601,
                message=f"No MCP server registered for method '{envelope.method}'",
                category="routing",
                hint="Register a server with the requested method capability.",
            )
            return MCPResponseEnvelope(jsonrpc=self.protocol_version, id=envelope.id, error=error)

        attempts = max(1, self.max_retries + 1)
        last_error: MCPError | None = None

        for _ in range(attempts):
            try:
                # Local placeholder dispatch; real transport bridge can replace this.
                result = await asyncio.wait_for(
                    self._simulate_local_dispatch(server, envelope),
                    timeout=self.timeout_seconds,
                )
                server.healthy = True
                server.last_error = None
                return MCPResponseEnvelope(jsonrpc=self.protocol_version, id=envelope.id, result=result)
            except asyncio.TimeoutError:
                last_error = self._build_error(
                    code=-32001,
                    message="MCP request timed out",
                    category="timeout",
                    hint="Increase timeout or verify server responsiveness.",
                )
            except ValueError as exc:
                last_error = self._build_error(
                    code=-32600,
                    message=str(exc),
                    category="validation",
                    hint="Validate request payload and method params shape.",
                )
            except Exception as exc:  # pragma: no cover - defensive fallback
                last_error = self._build_error(
                    code=-32000,
                    message=f"MCP transport failure: {exc}",
                    category="transport",
                    hint="Check local server process availability and logs.",
                )

        server.healthy = False
        server.last_error = last_error.model_dump() if last_error else None
        return MCPResponseEnvelope(jsonrpc=self.protocol_version, id=envelope.id, error=last_error)

    async def call_tool(self, method: str, params: dict) -> dict:
        """
        Helper para o RAGService (Agente) invocar ferramentas MCP de forma simplificada.
        """
        envelope = MCPRequestEnvelope(
            jsonrpc=self.protocol_version,
            id=str(uuid.uuid4()),
            method=method,
            params=params
        )
        
        response = await self.dispatch(envelope)
        
        if response.error:
            error_data = response.error.data or {}
            raise RuntimeError(
                f"MCP Tool Error [{response.error.code}]: {response.error.message} - "
                f"Hint: {error_data.get('hint', 'N/A')}"
            )
            
        return response.result
    
    async def _simulate_local_dispatch(
        self,
        server: MCPServerRegistration,
        envelope: MCPRequestEnvelope,
    ) -> dict:
        if not isinstance(envelope.params, dict):
            raise ValueError("Invalid params payload: expected object")

        method = envelope.method

        if method in {"search_semantic", "vector.search"}:
            qdrant = get_qdrant_retrieval_service()
            return await qdrant.search(**envelope.params)
            
        if method == "vector.upsert":
            qdrant = get_qdrant_retrieval_service()
            return await qdrant.upsert_payload(**envelope.params)

        if method == "vector.health":
            qdrant = get_qdrant_retrieval_service()
            return await qdrant.mcp_health()

        if method in {"execute_expansion", "graph.expand"}:
            neo4j = get_neo4j_service()
            return await neo4j.execute_expansion(**envelope.params)

        if method == "graph.query":
            neo4j = get_neo4j_service()
            return await neo4j.mcp_query(**envelope.params)

        if method == "graph.write":
            neo4j = get_neo4j_service()
            return await neo4j.mcp_write(**envelope.params)

        if method == "graph.health":
            neo4j = get_neo4j_service()
            return await neo4j.mcp_health()

        if method in {"rerank_by_impact", "sql.rerank"}:
            pg = get_postgres_mcp_service()
            return await pg.rerank_by_impact(**envelope.params)

        if method == "sql.query":
            pg = get_postgres_mcp_service()
            return await pg.mcp_query(**envelope.params)

        if method == "sql.write":
            pg = get_postgres_mcp_service()
            return await pg.mcp_write(**envelope.params)

        if method == "sql.health":
            pg = get_postgres_mcp_service()
            return await pg.mcp_health()

        return {
            "server": server.name,
            "method": method,
            "status": "ok",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def diagnostics(self) -> dict:
        servers = []
        method_server_map = {}
        for server in self._servers.values():
            for method in server.capabilities:
                method_server_map[method] = server.name
            servers.append(
                {
                    "name": server.name,
                    "capabilities": server.capabilities,
                    "healthy": server.healthy,
                    "lastError": server.last_error,
                }
            )
        healthy_servers = sum(1 for s in servers if s["healthy"])
        unhealthy_servers = len(servers) - healthy_servers
        return {
            "protocolVersion": self.protocol_version,
            "timeoutSeconds": self.timeout_seconds,
            "maxRetries": self.max_retries,
            "registeredServerCount": len(self._servers),
            "methodServerMap": method_server_map,
            "audit": {
                "registeredMethodCount": len(method_server_map),
                "healthyServerCount": healthy_servers,
                "unhealthyServerCount": unhealthy_servers,
            },
            "servers": servers,
        }

    def _build_error(self, code: int, message: str, category: str, hint: str) -> MCPError:
        return MCPError(
            code=code,
            message=message,
            data={
                "category": category,
                "hint": hint,
            },
        )
