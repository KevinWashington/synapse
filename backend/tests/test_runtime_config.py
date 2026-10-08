import asyncio

import pytest

from app.config import Settings


def test_assigned_review_flow_defaults_to_disabled():
    settings = Settings(_env_file=None)

    assert settings.ASSIGNED_REVIEW_FLOW_ENABLED is False


@pytest.mark.parametrize(
    ("configured_value", "expected"),
    [
        ("true", True),
        ("false", False),
        ("1", True),
        ("0", False),
    ],
)
def test_assigned_review_flow_parses_boolean_environment_values(configured_value, expected):
    settings = Settings(
        _env_file=None,
        ASSIGNED_REVIEW_FLOW_ENABLED=configured_value,
    )

    assert settings.ASSIGNED_REVIEW_FLOW_ENABLED is expected


def test_production_can_start_with_assigned_review_flow_disabled():
    settings = Settings(
        _env_file=None,
        APP_ENV="production",
        PUBLIC_APP_URL="https://synapse.labit.dev.br",
        GOOGLE_CLIENT_ID="client.apps.googleusercontent.com",
        SESSION_SECRET="a-production-session-secret-longer-than-32-characters",
        CREDENTIAL_ENCRYPTION_KEY="aFd1aGY8pniwHZQ1R8iY6bXdQSV7LP33aOs-zl45j2M=",
        SESSION_COOKIE_SECURE=True,
        ALLOWED_ORIGINS="https://synapse.labit.dev.br",
        ASSIGNED_REVIEW_FLOW_ENABLED="false",
    )

    settings.validate_runtime()

    assert settings.ASSIGNED_REVIEW_FLOW_ENABLED is False


def test_deepseek_key_is_not_required_at_startup():
    settings = Settings(_env_file=None, APP_ENV="development")

    settings.validate_runtime()
    assert not hasattr(settings, "DEEPSEEK_API_KEY")


def test_production_requires_google_session_and_encryption_settings():
    settings = Settings(
        _env_file=None,
        APP_ENV="production",
        PUBLIC_APP_URL="https://synapse.labit.dev.br",
        GOOGLE_CLIENT_ID="",
        SESSION_SECRET="",
        CREDENTIAL_ENCRYPTION_KEY="",
        SESSION_COOKIE_SECURE=True,
    )

    with pytest.raises(RuntimeError) as error:
        settings.validate_runtime()

    message = str(error.value)
    assert "GOOGLE_CLIENT_ID" in message
    assert "SESSION_SECRET" in message
    assert "CREDENTIAL_ENCRYPTION_KEY" in message
    assert "DEEPSEEK_API_KEY" not in message


def test_production_rejects_weak_session_and_invalid_encryption_key():
    settings = Settings(
        _env_file=None,
        APP_ENV="production",
        PUBLIC_APP_URL="https://synapse.labit.dev.br",
        GOOGLE_CLIENT_ID="client.apps.googleusercontent.com",
        SESSION_SECRET="too-short",
        CREDENTIAL_ENCRYPTION_KEY="not-a-fernet-key",
        SESSION_COOKIE_SECURE=True,
    )

    with pytest.raises(RuntimeError) as error:
        settings.validate_runtime()

    message = str(error.value)
    assert "SESSION_SECRET" in message
    assert "CREDENTIAL_ENCRYPTION_KEY" in message


def test_allowed_origins_rejects_wildcard_with_credentials():
    settings = Settings(_env_file=None, ALLOWED_ORIGINS="*")

    with pytest.raises(RuntimeError, match="wildcard"):
        settings.validate_runtime()


def test_allowed_origins_are_trimmed_and_deduplicated():
    settings = Settings(
        _env_file=None,
        ALLOWED_ORIGINS=(
            "https://synapse.labit.dev.br, http://localhost:5173,"
            "https://synapse.labit.dev.br"
        ),
    )

    assert settings.allowed_origins == [
        "https://synapse.labit.dev.br",
        "http://localhost:5173",
    ]


def test_ready_reports_revision_failure_without_exposing_secrets(monkeypatch):
    from app import main

    async def database_is_available():
        return {"connected": True}

    async def revision_fails():
        raise RuntimeError("revision mismatch at postgresql://user:secret@database")

    monkeypatch.setattr(type(main.settings), "validate_runtime", lambda self: None)
    monkeypatch.setattr(main, "db_health_check", database_is_available)
    monkeypatch.setattr(main, "assert_database_revision", revision_fails)

    response = asyncio.run(main.ready())
    body = response.body.decode("utf-8")

    assert response.status_code == 503
    assert '"migration":"error"' in body
    assert "secret" not in body
    assert "postgresql://" not in body
