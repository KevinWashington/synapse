"""Translate application, HTTP and validation failures into the public API contract."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from app.core.errors import ApplicationError

logger = logging.getLogger(__name__)


def normalize_http_detail(detail, status_code: int) -> dict:
    data = detail if isinstance(detail, dict) else {}
    result = {
        "code": data.get("code") or f"HTTP_{status_code}",
        "message": data.get("message")
        or data.get("error")
        or (detail if isinstance(detail, str) else "Não foi possível concluir a solicitação."),
    }
    if status_code >= 500:
        result["message"] = "Serviço temporariamente indisponível."
    extras = {key: value for key, value in data.items() if key not in {"code", "message", "error"}}
    result.update(extras)  # Preserve existing machine-readable context during migration.
    return result


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApplicationError)
    async def application_error(_request: Request, exc: ApplicationError):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    @app.exception_handler(HTTPException)
    async def http_error(_request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": normalize_http_detail(exc.detail, exc.status_code)},
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(_request: Request, exc: RequestValidationError):
        fields = [
            {"loc": list(error["loc"]), "message": error["msg"], "type": error["type"]}
            for error in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content={
                "detail": {
                    "code": "VALIDATION_ERROR",
                    "message": "Confira os campos informados.",
                    "context": {"fields": fields},
                }
            },
        )

    @app.exception_handler(Exception)
    async def unexpected_error(_request: Request, exc: Exception):
        logger.error("Unexpected API failure", exc_info=exc)
        return JSONResponse(
            status_code=500,
            content={
                "detail": {
                    "code": "INTERNAL_ERROR",
                    "message": "Não foi possível concluir a solicitação.",
                }
            },
        )
