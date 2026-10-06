from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from functools import lru_cache

from app.database import get_db
from app.config import settings
from app.core.security import decode_session_token
from app.models.user import User
from app.services.mcp_host_service import MCPHostService
from app.services.neo4j_service import Neo4jService, get_neo4j_service
from app.services.postgres_mcp_service import PostgresMCPService, get_postgres_mcp_service


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> User:
    """Dependency to get the current authenticated user."""
    token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    payload = decode_session_token(token) if token else None
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "SESSION_INVALID",
                "message": "Sessão ausente, inválida ou expirada."
            }
        )
    
    userId = int(payload["sub"])
    
    result = await db.execute(select(User).where(User.id == userId))
    user = result.scalar_one_or_none()
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "SESSION_INVALID",
                "message": "Usuário da sessão não foi encontrado."
            }
        )
    
    if not user.isActive:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "ACCOUNT_DISABLED",
                "message": "Sua conta foi desativada."
            }
        )
    
    return user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency to require admin role."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "Acesso negado",
                "message": "Você precisa ser administrador para acessar este recurso"
            }
        )
    return current_user


@lru_cache()
def get_mcp_host() -> MCPHostService:
    """Dependency provider for MCP host orchestrator service."""
    return MCPHostService()


@lru_cache()
def get_graph_mcp_service() -> Neo4jService:
    """Dependency provider for graph MCP service."""
    return get_neo4j_service()


@lru_cache()
def get_sql_mcp_service() -> PostgresMCPService:
    """Dependency provider for SQL MCP service."""
    return get_postgres_mcp_service()
