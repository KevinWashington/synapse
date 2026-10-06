"""Double-submit CSRF protection for cookie-authenticated mutations."""

import secrets

from fastapi import HTTPException, Request, status

from app.config import settings


SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
EXEMPT_PATHS = {"/api/auth/google", "/health", "/ready"}


def csrf_cookie_name() -> str:
    return f"{settings.SESSION_COOKIE_NAME}_csrf"


def require_csrf(request: Request) -> None:
    if request.method.upper() in SAFE_METHODS or request.url.path in EXEMPT_PATHS:
        return

    cookie_value = request.cookies.get(csrf_cookie_name())
    header_value = request.headers.get("X-CSRF-Token")
    if (
        not cookie_value
        or not header_value
        or not secrets.compare_digest(cookie_value, header_value)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "CSRF_VALIDATION_FAILED",
                "message": "A validação de segurança da solicitação falhou.",
            },
        )
