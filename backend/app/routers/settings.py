from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.settings import DeepSeekKeyStatus, DeepSeekKeyUpdate
from app.services.credential_vault import CredentialVault, get_credential_vault
from app.services.deepseek_credential_service import (
    DeepSeekCredentialService,
    get_deepseek_credential_service,
)


router = APIRouter()


def _status(user: User) -> DeepSeekKeyStatus:
    configured = bool(user.deepseekKeyCiphertext and user.deepseekKeyVersion)
    return DeepSeekKeyStatus(
        configured=configured,
        maskedKey=f"••••{user.deepseekKeyLastFour}" if configured else None,
        updatedAt=user.deepseekKeyUpdatedAt if configured else None,
    )


@router.get("/deepseek-key", response_model=DeepSeekKeyStatus)
def get_deepseek_key_status(
    current_user: User = Depends(get_current_user),
) -> DeepSeekKeyStatus:
    return _status(current_user)


@router.put("/deepseek-key", response_model=DeepSeekKeyStatus)
async def save_deepseek_key(
    data: DeepSeekKeyUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    vault: CredentialVault = Depends(get_credential_vault),
    credential_service: DeepSeekCredentialService = Depends(get_deepseek_credential_service),
) -> DeepSeekKeyStatus:
    api_key = data.apiKey.strip()
    await credential_service.validate(api_key)
    encrypted = vault.encrypt(current_user.id, api_key)
    current_user.deepseekKeyCiphertext = encrypted.ciphertext
    current_user.deepseekKeyVersion = encrypted.version
    current_user.deepseekKeyLastFour = api_key[-4:]
    current_user.deepseekKeyUpdatedAt = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(current_user)
    return _status(current_user)


@router.delete("/deepseek-key", response_model=DeepSeekKeyStatus)
async def delete_deepseek_key(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeepSeekKeyStatus:
    current_user.deepseekKeyCiphertext = None
    current_user.deepseekKeyVersion = None
    current_user.deepseekKeyLastFour = None
    current_user.deepseekKeyUpdatedAt = None
    await db.commit()
    return _status(current_user)
