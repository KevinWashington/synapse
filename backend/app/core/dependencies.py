from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from functools import lru_cache

from app.database import get_db
from app.core.security import decode_token
from app.models.user import User
from app.services.mcp_host_service import MCPHostService


security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Dependency to get the current authenticated user."""
    token = credentials.credentials
    payload = decode_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "Token inválido",
                "message": "Token malformado ou expirado"
            }
        )
    
    userId = payload.get("userId")
    if userId is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "Token inválido",
                "message": "Token não contém ID do usuário"
            }
        )
    
    result = await db.execute(select(User).where(User.id == userId))
    user = result.scalar_one_or_none()
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "Token inválido",
                "message": "Usuário não encontrado"
            }
        )
    
    if not user.isActive:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "Conta desativada",
                "message": "Sua conta foi desativada"
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
