import base64
from types import SimpleNamespace

import pytest


def master_key():
    return base64.urlsafe_b64encode(b"k" * 32).decode()


def test_vault_round_trip_randomization_and_user_binding():
    from app.services.credential_vault import CredentialVault, CredentialVaultError

    vault = CredentialVault(master_key())
    first = vault.encrypt(1, "sk-secret-value")
    second = vault.encrypt(1, "sk-secret-value")

    assert first.ciphertext != second.ciphertext
    assert vault.decrypt(1, first.ciphertext, first.version) == "sk-secret-value"
    with pytest.raises(CredentialVaultError):
        vault.decrypt(2, first.ciphertext, first.version)
    with pytest.raises(CredentialVaultError):
        vault.decrypt(1, first.ciphertext + "corrupt", first.version)


class Validator:
    async def validate(self, api_key):
        if api_key == "sk-invalid-key":
            from app.services.deepseek_credential_service import DeepSeekCredentialError

            raise DeepSeekCredentialError("DEEPSEEK_KEY_INVALID", "Chave inválida.")


class Database:
    def __init__(self):
        self.commits = 0

    async def commit(self):
        self.commits += 1

    async def refresh(self, user):
        return None


@pytest.mark.asyncio
async def test_key_status_save_replace_and_delete_without_plaintext():
    from app.routers.settings import delete_deepseek_key, get_deepseek_key_status, save_deepseek_key
    from app.schemas.settings import DeepSeekKeyUpdate
    from app.services.credential_vault import CredentialVault

    user = SimpleNamespace(
        id=7,
        deepseekKeyCiphertext=None,
        deepseekKeyVersion=None,
        deepseekKeyLastFour=None,
        deepseekKeyUpdatedAt=None,
    )
    db = Database()
    vault = CredentialVault(master_key())

    assert get_deepseek_key_status(user).configured is False
    saved = await save_deepseek_key(
        DeepSeekKeyUpdate(apiKey="sk-first-secret-1234"), user, db, vault, Validator()
    )
    assert saved.configured is True
    assert saved.maskedKey == "••••1234"
    assert "sk-first-secret" not in user.deepseekKeyCiphertext

    replaced = await save_deepseek_key(
        DeepSeekKeyUpdate(apiKey="sk-other-secret-9876"), user, db, vault, Validator()
    )
    assert replaced.maskedKey == "••••9876"

    deleted = await delete_deepseek_key(user, db)
    assert deleted.configured is False
    assert user.deepseekKeyCiphertext is None


@pytest.mark.asyncio
async def test_invalid_key_is_not_persisted():
    from app.routers.settings import save_deepseek_key
    from app.schemas.settings import DeepSeekKeyUpdate
    from app.services.credential_vault import CredentialVault
    from app.services.deepseek_credential_service import DeepSeekCredentialError

    user = SimpleNamespace(
        id=8,
        deepseekKeyCiphertext=None,
        deepseekKeyVersion=None,
        deepseekKeyLastFour=None,
        deepseekKeyUpdatedAt=None,
    )
    db = Database()
    with pytest.raises(DeepSeekCredentialError):
        await save_deepseek_key(
            DeepSeekKeyUpdate(apiKey="sk-invalid-key"),
            user,
            db,
            CredentialVault(master_key()),
            Validator(),
        )
    assert user.deepseekKeyCiphertext is None
    assert db.commits == 0
