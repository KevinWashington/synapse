import asyncio
from types import SimpleNamespace

import pytest

from app.core.dependencies import get_optional_user_ai_service
from app.core.errors import ApplicationError
from app.services.user_ai_service import build_user_ai_service


class Vault:
    def decrypt(self, user_id, ciphertext, version):
        if ciphertext == "corrupt":
            from app.services.credential_vault import CredentialVaultError

            raise CredentialVaultError("bad payload")
        return f"key-for-{user_id}"


def user(user_id, ciphertext="encrypted"):
    return SimpleNamespace(
        id=user_id,
        deepseekKeyCiphertext=ciphertext,
        deepseekKeyVersion=1 if ciphertext else None,
    )


def test_user_ai_service_requires_configured_valid_key():
    with pytest.raises(ApplicationError) as missing:
        build_user_ai_service(user(1, None), Vault())
    assert missing.value.code == "DEEPSEEK_KEY_REQUIRED"
    with pytest.raises(ApplicationError) as corrupted:
        build_user_ai_service(user(1, "corrupt"), Vault())
    assert corrupted.value.code == "DEEPSEEK_KEY_REQUIRED"


@pytest.mark.asyncio
async def test_concurrent_users_receive_only_their_own_key():
    first, second = await asyncio.gather(
        asyncio.to_thread(build_user_ai_service, user(1), Vault()),
        asyncio.to_thread(build_user_ai_service, user(2), Vault()),
    )

    assert first.api_key == "key-for-1"
    assert second.api_key == "key-for-2"
    assert first is not second


def test_request_routes_do_not_use_global_ai_factory():
    from pathlib import Path

    backend = Path(__file__).resolve().parents[1]
    for relative in ("app/routers/ai.py", "app/routers/articles.py"):
        source = (backend / relative).read_text(encoding="utf-8")
        assert "get_ai_service(" not in source


def test_optional_vault_tolerates_missing_development_master_key(monkeypatch):
    from app.config import settings
    from app.core.dependencies import get_optional_credential_vault

    monkeypatch.setattr(settings, "CREDENTIAL_ENCRYPTION_KEY", "")

    assert get_optional_credential_vault() is None


@pytest.mark.asyncio
async def test_optional_ai_service_stays_disabled_when_vault_is_unavailable():
    assert await get_optional_user_ai_service(user(1), None) is None


def test_missing_user_key_raises_framework_independent_application_error():
    with pytest.raises(ApplicationError) as error:
        build_user_ai_service(user(1, None), Vault())

    assert error.value.code == "DEEPSEEK_KEY_REQUIRED"
    assert error.value.status_code == 428
