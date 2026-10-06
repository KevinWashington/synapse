from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException, Response
from starlette.requests import Request

from app.config import settings
from app.core.csrf import csrf_cookie_name, require_csrf
from app.core.dependencies import get_current_user
from app.core.security import (
    clear_session_cookies,
    create_session_token,
    decode_session_token,
    set_session_cookies,
)


def _request(method="GET", path="/api/projetos", cookie="", csrf_header=None):
    headers = []
    if cookie:
        headers.append((b"cookie", cookie.encode()))
    if csrf_header is not None:
        headers.append((b"x-csrf-token", csrf_header.encode()))
    return Request(
        {
            "type": "http",
            "method": method,
            "path": path,
            "headers": headers,
        }
    )


@pytest.fixture(autouse=True)
def secure_settings(monkeypatch):
    monkeypatch.setattr(settings, "SESSION_SECRET", "s" * 64)
    monkeypatch.setattr(settings, "SESSION_COOKIE_NAME", "synapse_session")
    monkeypatch.setattr(settings, "SESSION_COOKIE_SECURE", True)
    monkeypatch.setattr(settings, "SESSION_TTL_MINUTES", 60)


def test_session_token_round_trip_and_tampering():
    token = create_session_token(42)
    assert decode_session_token(token)["sub"] == "42"
    assert decode_session_token(token + "tampered") is None


def test_expired_session_is_rejected():
    from jose import jwt

    token = jwt.encode(
        {
            "sub": "42",
            "type": "session",
            "iat": datetime.now(timezone.utc) - timedelta(hours=2),
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),
        },
        settings.SESSION_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )
    assert decode_session_token(token) is None


def test_session_cookies_have_production_attributes():
    response = Response()
    set_session_cookies(response, 7)
    cookies = "\n".join(response.headers.getlist("set-cookie")).lower()

    assert "synapse_session=" in cookies
    assert "httponly" in cookies
    assert "secure" in cookies
    assert "samesite=lax" in cookies
    assert f"{csrf_cookie_name()}=" in cookies


def test_clear_session_cookies_expires_both_cookies():
    response = Response()
    clear_session_cookies(response)
    cookies = "\n".join(response.headers.getlist("set-cookie")).lower()

    assert "synapse_session=" in cookies
    assert f"{csrf_cookie_name()}=" in cookies
    assert cookies.count("max-age=0") == 2


def test_csrf_accepts_match_and_rejects_missing_or_mismatch():
    name = csrf_cookie_name()
    require_csrf(
        _request(
            "POST",
            cookie=f"synapse_session=present; {name}=same",
            csrf_header="same",
        )
    )

    for request in (
        _request("POST", cookie="synapse_session=present"),
        _request(
            "DELETE",
            cookie=f"synapse_session=present; {name}=one",
            csrf_header="two",
        ),
    ):
        with pytest.raises(HTTPException) as error:
            require_csrf(request)
        assert error.value.status_code == 403


def test_csrf_exempts_safe_methods_and_google_login():
    require_csrf(_request("GET"))
    require_csrf(_request("POST", path="/api/auth/google"))


@pytest.mark.asyncio
async def test_current_user_comes_from_cookie():
    class Result:
        @staticmethod
        def scalar_one_or_none():
            return type("User", (), {"id": 9, "isActive": True})()

    class Database:
        async def execute(self, statement):
            return Result()

    token = create_session_token(9)
    user = await get_current_user(
        request=_request(cookie=f"synapse_session={token}"),
        db=Database(),
    )
    assert user.id == 9


@pytest.mark.asyncio
async def test_current_user_rejects_missing_cookie():
    with pytest.raises(HTTPException) as error:
        await get_current_user(request=_request(), db=object())
    assert error.value.status_code == 401
