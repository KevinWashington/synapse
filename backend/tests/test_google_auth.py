from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException, Response
from httpx import ASGITransport, AsyncClient

from app.models.user import User
from app.services.google_identity_service import GoogleIdentity


class Result:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class FakeDatabase:
    def __init__(self, results):
        self.results = list(results)
        self.added = []
        self.commits = 0

    async def execute(self, statement):
        return Result(self.results.pop(0))

    def add(self, user):
        self.added.append(user)

    async def commit(self):
        self.commits += 1

    async def flush(self):
        for value in self.added:
            if getattr(value, "id", None) is None:
                value.id = 99

    async def refresh(self, user):
        user.id = user.id or 99
        now = datetime.now(timezone.utc)
        user.createdAt = getattr(user, "createdAt", None) or now
        user.updatedAt = getattr(user, "updatedAt", None) or now


class IdentityService:
    def __init__(self, identity):
        self.identity = identity

    def verify(self, credential):
        return self.identity


def identity(sub="google-1", email="user@example.com"):
    return GoogleIdentity(
        sub=sub,
        email=email,
        email_verified=True,
        name="Google User",
        avatar="https://example.com/avatar.png",
    )


def user(**overrides):
    now = datetime.now(timezone.utc)
    values = {
        "id": 1,
        "name": "Legacy",
        "email": "user@example.com",
        "passwordHash": "legacy-hash",
        "googleSub": None,
        "role": "user",
        "isActive": True,
        "avatar": None,
        "lastLogin": None,
        "createdAt": now,
        "updatedAt": now,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


@pytest.mark.asyncio
async def test_google_login_creates_new_account_and_session_cookie(monkeypatch):
    from app.routers import auth
    from app.schemas.auth import GoogleCredentialRequest

    db = FakeDatabase([None, None])
    response = Response()
    monkeypatch.setattr(
        auth,
        "_new_user",
        lambda value: user(
            id=None,
            name=value.name,
            email=value.email,
            passwordHash=None,
            googleSub=value.sub,
            avatar=value.avatar,
        ),
    )
    result = await auth.google_login(
        GoogleCredentialRequest(credential="credential"),
        response,
        db,
        IdentityService(identity()),
    )

    assert result.user.googleSub == "google-1"
    assert result.user.email == "user@example.com"
    assert result.model_dump().get("token") is None
    assert db.added[0].passwordHash is None
    assert "synapse_session=" in "\n".join(response.headers.getlist("set-cookie"))


@pytest.mark.asyncio
async def test_google_login_links_legacy_account_by_verified_email(monkeypatch):
    from app.routers.auth import google_login
    from app.schemas.auth import GoogleCredentialRequest

    legacy = user()
    result = await google_login(
        GoogleCredentialRequest(credential="credential"),
        Response(),
        FakeDatabase([None, legacy]),
        IdentityService(identity()),
    )

    assert result.user.id == legacy.id
    assert legacy.googleSub == "google-1"
    assert legacy.passwordHash == "legacy-hash"


@pytest.mark.asyncio
async def test_google_login_rejects_conflicting_or_disabled_account(monkeypatch):
    from app.routers.auth import google_login
    from app.schemas.auth import GoogleCredentialRequest

    cases = [
        (FakeDatabase([None, user(googleSub="other")]), 409),
        (FakeDatabase([user(isActive=False)]), 401),
    ]
    for db, expected_status in cases:
        with pytest.raises(HTTPException) as error:
            await google_login(
                GoogleCredentialRequest(credential="credential"),
                Response(),
                db,
                IdentityService(identity()),
            )
        assert error.value.status_code == expected_status


def test_profile_response_and_logout_cookie_deletion():
    from app.routers.auth import get_profile, logout

    current = user(googleSub="google-1")
    profile = get_profile(current)
    assert profile["user"].googleSub == "google-1"

    response = Response()
    result = logout(response, current)
    assert result["success"] is True
    cookies = "\n".join(response.headers.getlist("set-cookie")).lower()
    assert cookies.count("max-age=0") == 2


def test_password_routes_are_removed():
    from app.main import app

    routes = {(route.path, method) for route in app.routes for method in getattr(route, "methods", set())}
    assert ("/api/auth/register", "POST") not in routes
    assert ("/api/auth/login", "POST") not in routes
    assert ("/api/auth/change-password", "PUT") not in routes
    assert ("/api/auth/google", "POST") in routes


@pytest.mark.asyncio
async def test_removed_password_routes_return_not_found_over_http():
    from app.main import app

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        responses = [
            await client.post("/api/auth/register", json={}),
            await client.post("/api/auth/login", json={}),
            await client.put("/api/auth/change-password", json={}),
        ]

    assert all(response.status_code in {404, 405} for response in responses)
