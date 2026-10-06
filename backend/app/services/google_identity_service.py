"""Verification and normalization for Google Identity Services credentials."""

from dataclasses import dataclass
import time

from google.auth.transport.requests import Request
from google.oauth2 import id_token as google_id_token

from app.config import settings


@dataclass(frozen=True)
class GoogleIdentity:
    sub: str
    email: str
    email_verified: bool
    name: str
    avatar: str | None


class GoogleIdentityError(Exception):
    def __init__(self, code: str, public_message: str):
        self.code = code
        self.public_message = public_message
        super().__init__(public_message)


class GoogleIdentityService:
    def __init__(self, client_id: str | None = None):
        self.client_id = client_id or settings.GOOGLE_CLIENT_ID

    def verify(self, credential: str) -> GoogleIdentity:
        if not credential or len(credential) > 8192:
            raise GoogleIdentityError("INVALID_CREDENTIAL", "Credencial Google inválida.")

        try:
            claims = google_id_token.verify_oauth2_token(
                credential,
                Request(),
                self.client_id,
            )
        except ValueError as exc:
            raise GoogleIdentityError(
                "INVALID_CREDENTIAL", "Não foi possível validar a credencial Google."
            ) from exc
        except Exception as exc:
            raise GoogleIdentityError(
                "IDENTITY_PROVIDER_UNAVAILABLE",
                "O serviço de identidade está temporariamente indisponível.",
            ) from exc

        if claims.get("aud") != self.client_id:
            raise GoogleIdentityError("INVALID_AUDIENCE", "Credencial destinada a outro aplicativo.")
        if claims.get("iss") not in {"accounts.google.com", "https://accounts.google.com"}:
            raise GoogleIdentityError("INVALID_ISSUER", "Emissor da credencial não reconhecido.")
        if not isinstance(claims.get("exp"), (int, float)) or claims["exp"] <= time.time():
            raise GoogleIdentityError("TOKEN_EXPIRED", "A credencial Google expirou.")
        if claims.get("email_verified") is not True:
            raise GoogleIdentityError("EMAIL_NOT_VERIFIED", "O e-mail Google não está verificado.")

        subject = claims.get("sub")
        email = claims.get("email")
        if not isinstance(subject, str) or not subject.strip():
            raise GoogleIdentityError("INVALID_IDENTITY", "Identidade Google incompleta.")
        if not isinstance(email, str) or not email.strip():
            raise GoogleIdentityError("INVALID_IDENTITY", "Identidade Google incompleta.")

        normalized_email = email.strip().casefold()
        name = claims.get("name")
        avatar = claims.get("picture")
        return GoogleIdentity(
            sub=subject.strip(),
            email=normalized_email,
            email_verified=True,
            name=name.strip() if isinstance(name, str) and name.strip() else normalized_email,
            avatar=avatar if isinstance(avatar, str) and avatar else None,
        )


def get_google_identity_service() -> GoogleIdentityService:
    return GoogleIdentityService()
