"""Authenticated encryption for user-owned provider credentials."""

import base64
from dataclasses import dataclass
import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import settings


@dataclass(frozen=True)
class EncryptedCredential:
    ciphertext: str
    version: int = 1


class CredentialVaultError(Exception):
    pass


class CredentialVault:
    def __init__(self, encoded_master_key: str):
        try:
            key = base64.urlsafe_b64decode(encoded_master_key.encode("ascii"))
        except Exception as exc:
            raise CredentialVaultError("Invalid credential encryption key.") from exc
        if len(key) != 32:
            raise CredentialVaultError("Credential encryption key must decode to 32 bytes.")
        self._cipher = AESGCM(key)

    @staticmethod
    def _aad(user_id: int, version: int) -> bytes:
        return f"synapse:user:{user_id}:deepseek:v{version}".encode("utf-8")

    def encrypt(self, user_id: int, plaintext: str) -> EncryptedCredential:
        version = 1
        nonce = os.urandom(12)
        encrypted = self._cipher.encrypt(
            nonce,
            plaintext.encode("utf-8"),
            self._aad(user_id, version),
        )
        payload = base64.urlsafe_b64encode(nonce + encrypted).decode("ascii")
        return EncryptedCredential(ciphertext=payload, version=version)

    def decrypt(self, user_id: int, ciphertext: str, version: int) -> str:
        if version != 1:
            raise CredentialVaultError("Unsupported credential version.")
        try:
            payload = base64.b64decode(
                ciphertext.encode("ascii"), altchars=b"-_", validate=True
            )
            if len(payload) <= 28:
                raise ValueError("Invalid encrypted payload")
            plaintext = self._cipher.decrypt(
                payload[:12], payload[12:], self._aad(user_id, version)
            )
            return plaintext.decode("utf-8")
        except (InvalidTag, ValueError, UnicodeError, TypeError) as exc:
            raise CredentialVaultError("Credential decryption failed.") from exc


def get_credential_vault() -> CredentialVault:
    return CredentialVault(settings.CREDENTIAL_ENCRYPTION_KEY)
