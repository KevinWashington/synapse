from __future__ import annotations

import re

from sqlalchemy import text

from app.config import settings
from app.database import async_session_maker, db_health_check


class PostgresMCPService:
    """MCP wrapper around PostgreSQL query/write/health operations."""

    _WRITE_PREFIXES = ("insert", "update", "delete")
    _BLOCKED_PREFIXES = (
        "drop",
        "alter",
        "truncate",
        "create",
        "grant",
        "revoke",
    )

    def __init__(self):
        self.max_rows = settings.SQL_MCP_MAX_ROWS
        self.allowed_write_tables = {
            t.strip().lower() for t in settings.SQL_MCP_ALLOW_WRITE_TABLES.split(",") if t.strip()
        }

    async def mcp_query(self, query: str, params: dict | None = None, max_rows: int | None = None) -> dict:
        params = params or {}
        safe_limit = min(max_rows or self.max_rows, self.max_rows)

        if self._is_blocked_statement(query):
            return {
                "ok": False,
                "method": "sql.query",
                "error": {
                    "category": "validation",
                    "message": "Disallowed SQL statement class",
                    "hint": "Only SELECT queries are allowed in sql.query.",
                },
            }

        try:
            async with async_session_maker() as session:
                result = await session.execute(text(query), params)
                rows = [dict(row._mapping) for row in result.fetchmany(safe_limit)]
            return {
                "ok": True,
                "method": "sql.query",
                "rows": rows,
                "rowCount": len(rows),
                "maxRowsApplied": safe_limit,
            }
        except Exception as exc:
            return {
                "ok": False,
                "method": "sql.query",
                "error": {
                    "category": "sql",
                    "message": str(exc),
                    "hint": "Validate SQL syntax, params, and DB connectivity.",
                },
            }

    async def mcp_write(self, query: str, params: dict | None = None) -> dict:
        params = params or {}

        if self._is_blocked_statement(query):
            return {
                "ok": False,
                "method": "sql.write",
                "error": {
                    "category": "validation",
                    "message": "Disallowed SQL write statement class",
                    "hint": "Only INSERT/UPDATE/DELETE are allowed in sql.write.",
                },
            }

        table_name = self._extract_table_name(query)
        if table_name and table_name not in self.allowed_write_tables:
            return {
                "ok": False,
                "method": "sql.write",
                "error": {
                    "category": "validation",
                    "message": f"Writes to table '{table_name}' are not allowed",
                    "hint": "Add table to SQL_MCP_ALLOW_WRITE_TABLES if required.",
                },
            }

        try:
            async with async_session_maker() as session:
                result = await session.execute(text(query), params)
                await session.commit()
            return {
                "ok": True,
                "method": "sql.write",
                "rowsAffected": result.rowcount,
            }
        except Exception as exc:
            return {
                "ok": False,
                "method": "sql.write",
                "error": {
                    "category": "sql",
                    "message": str(exc),
                    "hint": "Validate write SQL and table permissions.",
                },
            }

    async def mcp_health(self) -> dict:
        health = await db_health_check()
        return {
            "connected": bool(health.get("connected")),
            "vectorExtension": bool(health.get("vectorExtension")),
            "server": "postgres",
            "details": health,
        }

    async def lookup_by_paper_id(self, project_id: int, paper_id: str) -> dict:
        """Project-scoped relational lookup for a canonical paper_id."""
        query = """
            SELECT id, "paperId", title, "projectId"
            FROM articles
            WHERE "projectId" = :project_id
              AND "paperId" = :paper_id
            LIMIT 1
        """
        return await self.mcp_query(query=query, params={"project_id": project_id, "paper_id": paper_id}, max_rows=1)

    async def paper_id_counts(self, project_id: int) -> dict:
        """Return project-scoped paper_id availability counts."""
        query = """
            SELECT
                COUNT(*)::int AS total,
                COUNT("paperId")::int AS with_anchor,
                (COUNT(*) - COUNT("paperId"))::int AS missing_anchor
            FROM articles
            WHERE "projectId" = :project_id
        """
        result = await self.mcp_query(query=query, params={"project_id": project_id}, max_rows=1)
        if not result.get("ok"):
            return {
                "ok": False,
                "error": result.get("error"),
            }
        row = (result.get("rows") or [{}])[0]
        return {
            "ok": True,
            "total": row.get("total", 0),
            "with_anchor": row.get("with_anchor", 0),
            "missing_anchor": row.get("missing_anchor", 0),
        }

    def _is_blocked_statement(self, query: str) -> bool:
        lowered = query.strip().lower()
        if any(lowered.startswith(prefix) for prefix in self._BLOCKED_PREFIXES):
            return True

        if lowered.startswith("select"):
            return False

        if any(lowered.startswith(prefix) for prefix in self._WRITE_PREFIXES):
            return False

        return True

    def _extract_table_name(self, query: str) -> str | None:
        lowered = query.strip().lower()

        insert_match = re.search(r"insert\s+into\s+([\w\"]+)", lowered)
        if insert_match:
            return insert_match.group(1).replace('"', "")

        update_match = re.search(r"update\s+([\w\"]+)", lowered)
        if update_match:
            return update_match.group(1).replace('"', "")

        delete_match = re.search(r"delete\s+from\s+([\w\"]+)", lowered)
        if delete_match:
            return delete_match.group(1).replace('"', "")

        return None


_postgres_mcp_service: PostgresMCPService | None = None


def get_postgres_mcp_service() -> PostgresMCPService:
    global _postgres_mcp_service
    if _postgres_mcp_service is None:
        _postgres_mcp_service = PostgresMCPService()
    return _postgres_mcp_service
