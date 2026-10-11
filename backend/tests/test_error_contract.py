from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field


def error_app():
    from app.core.error_handlers import install_error_handlers
    from app.core.errors import ApplicationError

    app = FastAPI()
    install_error_handlers(app)

    @app.get("/legacy")
    def legacy():
        raise HTTPException(
            400, detail={"error": "Entrada inválida", "message": "Confira o título"}
        )

    @app.get("/conflict")
    def conflict():
        raise ApplicationError(
            "SYNTHESIS_VERSION_CONFLICT", "Outra versão foi salva", status_code=409
        )

    @app.get("/unexpected")
    def unexpected():
        raise RuntimeError("private-key-must-not-leak")

    class Payload(BaseModel):
        count: int = Field(ge=1)

    @app.post("/validate")
    def validate(payload: Payload):
        return payload

    return app


def test_legacy_http_error_has_stable_code_and_public_message():
    response = TestClient(error_app()).get("/legacy")
    assert response.status_code == 400
    assert response.json()["detail"] == {"code": "HTTP_400", "message": "Confira o título"}


def test_application_error_preserves_conflict_code_and_status():
    response = TestClient(error_app()).get("/conflict")
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "SYNTHESIS_VERSION_CONFLICT"


def test_validation_error_preserves_field_information_without_input_values():
    response = TestClient(error_app()).post("/validate", json={"count": 0})
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["code"] == "VALIDATION_ERROR"
    assert detail["context"]["fields"][0]["loc"] == ["body", "count"]
    assert "input" not in detail["context"]["fields"][0]


def test_unexpected_error_is_sanitized():
    response = TestClient(error_app(), raise_server_exceptions=False).get("/unexpected")
    assert response.status_code == 500
    assert response.json()["detail"]["code"] == "INTERNAL_ERROR"
    assert "private-key" not in response.text
