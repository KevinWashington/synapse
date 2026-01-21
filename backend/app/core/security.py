from datetime import datetime, timedelta, timezone
import hashlib
import bcrypt
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


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    prepared = _prepare_password(plain_password)
    return bcrypt.checkpw(prepared, hashed_password.encode('utf-8'))


def create_access_token(user_id: int) -> str:
    """Create a JWT access token."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {
        "user_id": user_id,
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
