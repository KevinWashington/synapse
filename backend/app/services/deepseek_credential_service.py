"""Validation of user-provided DeepSeek API keys."""

import httpx
from fastapi import HTTPException

from app.config import settings


class DeepSeekCredentialError(HTTPException):
    def __init__(self, code: str, public_message: str, status_code: int | None = None):
        self.code = code
        self.public_message = public_message
        resolved_status = status_code or {
            "DEEPSEEK_KEY_INVALID": 401,
            "DEEPSEEK_RATE_LIMITED": 429,
        }.get(code, 503)
        super().__init__(
            status_code=resolved_status,
            detail={"code": code, "message": public_message},
        )


class DeepSeekCredentialService:
    async def validate(self, api_key: str) -> None:
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(8.0)) as client:
                response = await client.get(
                    f"{settings.DEEPSEEK_BASE_URL.rstrip('/')}/models",
                    headers={"Authorization": f"Bearer {api_key}"},
                )
        except (httpx.TimeoutException, httpx.NetworkError) as exc:
            raise DeepSeekCredentialError(
                "DEEPSEEK_UNAVAILABLE",
                "Não foi possível validar a chave agora. Tente novamente.",
            ) from exc

        if response.status_code in {401, 403}:
            raise DeepSeekCredentialError("DEEPSEEK_KEY_INVALID", "A chave DeepSeek é inválida.")
        if response.status_code == 429:
            raise DeepSeekCredentialError(
                "DEEPSEEK_RATE_LIMITED", "A DeepSeek limitou temporariamente a validação."
            )
        if response.status_code >= 400:
            raise DeepSeekCredentialError(
                "DEEPSEEK_UNAVAILABLE", "A DeepSeek está temporariamente indisponível."
            )


def get_deepseek_credential_service() -> DeepSeekCredentialService:
    return DeepSeekCredentialService()
