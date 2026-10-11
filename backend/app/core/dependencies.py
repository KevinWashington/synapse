from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from functools import lru_cache

from app.database import get_db
from app.config import settings
from app.core.security import decode_session_token
from app.models.user import User
from app.services.ai_service import AIService
from app.core.errors import ApplicationError
from app.services.credential_vault import (
    CredentialVault,
    CredentialVaultError,
    get_credential_vault,
)
from app.services.mcp_host_service import get_mcp_host
from app.services.neo4j_service import Neo4jService, get_neo4j_service
from app.services.postgres_mcp_service import PostgresMCPService, get_postgres_mcp_service
from app.services.project_access_service import ProjectAccess, resolve_project_access
from app.services.user_ai_service import build_user_ai_service


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


async def get_project_access(
    projectId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectAccess:
    return await resolve_project_access(db, project_id=projectId, user_id=current_user.id)


def get_optional_credential_vault() -> CredentialVault | None:
    try:
        return get_credential_vault()
    except CredentialVaultError:
        return None


async def get_user_ai_service(
    current_user: User = Depends(get_current_user),
    vault: CredentialVault = Depends(get_credential_vault),
) -> AIService:
    return build_user_ai_service(current_user, vault)


async def get_optional_user_ai_service(
    current_user: User = Depends(get_current_user),
    vault: CredentialVault | None = Depends(get_optional_credential_vault),
) -> AIService | None:
    if vault is None:
        return None
    try:
        return await get_user_ai_service(current_user, vault)
    except ApplicationError as exc:
        if exc.code != "DEEPSEEK_KEY_REQUIRED":
            raise
        return None


@lru_cache()
def get_graph_mcp_service() -> Neo4jService:
    """Dependency provider for graph MCP service."""
    return get_neo4j_service()


@lru_cache()
def get_sql_mcp_service() -> PostgresMCPService:
    """Dependency provider for SQL MCP service."""
    return get_postgres_mcp_service()
