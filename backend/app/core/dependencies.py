from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from functools import lru_cache

from app.database import get_db
from app.config import settings
from app.core.security import decode_session_token
from app.models.user import User
from app.services.ai_service import AIService
from app.services.credential_vault import (
    CredentialVault,
    CredentialVaultError,
    get_credential_vault,
)
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


class DeepSeekKeyRequiredError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_428_PRECONDITION_REQUIRED,
            detail={
                "code": "DEEPSEEK_KEY_REQUIRED",
                "message": "Configure sua chave DeepSeek nas configurações para usar recursos de IA.",
            },
        )


async def get_user_ai_service(
    current_user: User = Depends(get_current_user),
    vault: CredentialVault = Depends(get_credential_vault),
) -> AIService:
    if not current_user.deepseekKeyCiphertext or not current_user.deepseekKeyVersion:
        raise DeepSeekKeyRequiredError()
    try:
        api_key = vault.decrypt(
            current_user.id,
            current_user.deepseekKeyCiphertext,
            current_user.deepseekKeyVersion,
        )
    except CredentialVaultError as exc:
        raise DeepSeekKeyRequiredError() from exc
    return AIService(api_key=api_key)


async def get_optional_user_ai_service(
    current_user: User = Depends(get_current_user),
    vault: CredentialVault = Depends(get_credential_vault),
) -> AIService | None:
    try:
        return await get_user_ai_service(current_user, vault)
    except DeepSeekKeyRequiredError:
        return None


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
