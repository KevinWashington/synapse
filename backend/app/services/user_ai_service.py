"""Build user-scoped AI clients without depending on FastAPI."""

from app.core.errors import ApplicationError
from app.models.user import User
from app.services.ai_service import AIService
from app.services.credential_vault import CredentialVault, CredentialVaultError


def build_user_ai_service(user: User, vault: CredentialVault) -> AIService:
    if not user.deepseekKeyCiphertext or not user.deepseekKeyVersion:
        raise ApplicationError(
            "DEEPSEEK_KEY_REQUIRED",
            "Configure sua chave DeepSeek nas configurações para usar recursos de IA.",
            status_code=428,
        )
    try:
        api_key = vault.decrypt(
            user.id,
            user.deepseekKeyCiphertext,
            user.deepseekKeyVersion,
        )
    except CredentialVaultError as exc:
        raise ApplicationError(
            "DEEPSEEK_KEY_REQUIRED",
            "Configure sua chave DeepSeek nas configurações para usar recursos de IA.",
            status_code=428,
        ) from exc
    return AIService(api_key=api_key)
