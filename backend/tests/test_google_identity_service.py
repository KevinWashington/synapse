import time

import pytest


def _claims(**overrides):
    claims = {
        "sub": "google-subject-1",
        "email": " User@Example.COM ",
        "email_verified": True,
        "name": "Example User",
        "picture": "https://example.com/avatar.png",
        "aud": "client-id",
        "iss": "https://accounts.google.com",
        "exp": int(time.time()) + 300,
    }
    claims.update(overrides)
    return claims


def _service(monkeypatch, claims=None, error=None):
    from app.services import google_identity_service as module

    def verify(*args, **kwargs):
        if error:
            raise error
        return claims or _claims()

    monkeypatch.setattr(module.google_id_token, "verify_oauth2_token", verify)
    return module.GoogleIdentityService(client_id="client-id")


def test_valid_claims_are_normalized(monkeypatch):
    identity = _service(monkeypatch).verify("opaque-credential")

    assert identity.sub == "google-subject-1"
    assert identity.email == "user@example.com"
    assert identity.email_verified is True
    assert identity.name == "Example User"
    assert identity.avatar == "https://example.com/avatar.png"


@pytest.mark.parametrize(
    ("overrides", "code"),
    [
        ({"aud": "other-client"}, "INVALID_AUDIENCE"),
        ({"iss": "https://attacker.example"}, "INVALID_ISSUER"),
        ({"exp": int(time.time()) - 1}, "TOKEN_EXPIRED"),
        ({"email_verified": False}, "EMAIL_NOT_VERIFIED"),
        ({"sub": ""}, "INVALID_IDENTITY"),
    ],
)
def test_invalid_claims_have_stable_codes(monkeypatch, overrides, code):
    from app.services.google_identity_service import GoogleIdentityError

    service = _service(monkeypatch, _claims(**overrides))

    with pytest.raises(GoogleIdentityError) as error:
        service.verify("opaque-credential")

    assert error.value.code == code


def test_provider_failure_does_not_expose_credential(monkeypatch, caplog):
    from app.services.google_identity_service import GoogleIdentityError

    credential = "sensitive-google-credential"
    service = _service(monkeypatch, error=OSError("provider unavailable"))

    with pytest.raises(GoogleIdentityError) as error:
        service.verify(credential)

    assert error.value.code == "IDENTITY_PROVIDER_UNAVAILABLE"
    assert credential not in str(error.value)
    assert credential not in caplog.text
