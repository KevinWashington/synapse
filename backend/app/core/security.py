from datetime import datetime, timedelta, timezone
import hashlib
import bcrypt
import secrets
from fastapi import Response
from jose import JWTError, jwt

from app.config import settings


def _prepare_password(password: str) -> bytes:
    """Prepare password for bcrypt by SHA256 hashing first to avoid 72 byte limit."""
    # SHA256 hash produces fixed 64 hex chars, always under 72 bytes
    return hashlib.sha256(password.encode('utf-8')).hexdigest().encode('utf-8')


def hash_password(password: str) -> str:
    """Hash a password using bcrypt with SHA256 prehash."""
    prepared = _prepare_password(password)
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(prepared, salt).decode('utf-8')


def verify_password(plain_password: str, hashedPassword: str | None) -> bool:
    """Verify a password against its hash."""
    if not hashedPassword:
        return False
    prepared = _prepare_password(plain_password)
    return bcrypt.checkpw(prepared, hashedPassword.encode('utf-8'))


def create_access_token(userId: int) -> str:
    """Create a JWT access token."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {
        "userId": userId,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict | None:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(
            token, 
            settings.JWT_SECRET, 
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError:
        return None


def _session_secret() -> str:
    return settings.SESSION_SECRET or settings.JWT_SECRET


def create_session_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "type": "session",
        "iat": now,
        "exp": now + timedelta(minutes=settings.SESSION_TTL_MINUTES),
    }
    return jwt.encode(payload, _session_secret(), algorithm=settings.JWT_ALGORITHM)


def decode_session_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(
            token,
            _session_secret(),
            algorithms=[settings.JWT_ALGORITHM],
        )
        if payload.get("type") != "session":
            return None
        user_id = int(payload.get("sub", ""))
        if user_id <= 0:
            return None
        return payload
    except (JWTError, TypeError, ValueError):
        return None


def set_session_cookies(response: Response, user_id: int) -> None:
    from app.core.csrf import csrf_cookie_name

    max_age = settings.SESSION_TTL_MINUTES * 60
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=create_session_token(user_id),
        max_age=max_age,
        httponly=True,
        secure=settings.SESSION_COOKIE_SECURE,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        key=csrf_cookie_name(),
        value=secrets.token_urlsafe(32),
        max_age=max_age,
        httponly=False,
        secure=settings.SESSION_COOKIE_SECURE,
        samesite="lax",
        path="/",
    )


def clear_session_cookies(response: Response) -> None:
    from app.core.csrf import csrf_cookie_name

    for name in (settings.SESSION_COOKIE_NAME, csrf_cookie_name()):
        response.delete_cookie(
            key=name,
            httponly=name == settings.SESSION_COOKIE_NAME,
            secure=settings.SESSION_COOKIE_SECURE,
            samesite="lax",
            path="/",
        )
