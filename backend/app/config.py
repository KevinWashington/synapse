from functools import lru_cache
from cryptography.fernet import Fernet
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",
    )

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://synapse:synapse@localhost:5432/synapse"

    # Application and browser security
    APP_ENV: str = "development"
    PUBLIC_APP_URL: str = "http://localhost:3000"
    GOOGLE_CLIENT_ID: str = ""
    SESSION_SECRET: str = ""
    SESSION_COOKIE_NAME: str = "synapse_session"
    SESSION_COOKIE_SECURE: bool = False
    SESSION_TTL_MINUTES: int = 10080
    CREDENTIAL_ENCRYPTION_KEY: str = ""
    ALLOWED_ORIGINS: str = (
        "https://synapse.labit.dev.br,"
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:5173,http://127.0.0.1:5173"
    )
    
    # JWT
    JWT_SECRET: str = "change_this_secret_in_production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 10080  # 7 days
    
    # DeepSeek
    DEEPSEEK_MODEL: str = "deepseek-chat"
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com"
    HF_TOKEN: str = ""
    
    # Neo4j
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "synapse123"
    
    # Server
    PORT: int = 5000
    DEBUG: bool = False

    # MCP host orchestration
    MCP_PROTOCOL_VERSION: str = "2.0"
    MCP_REQUEST_TIMEOUT_SECONDS: int = 15
    MCP_MAX_RETRIES: int = 1
    MCP_REGISTERED_SERVERS: str = "qdrant,neo4j,postgres"

    # Retrieval backend
    RETRIEVAL_BACKEND: str = "qdrant"
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_COLLECTION: str = "articles"

    # PostgreSQL MCP safeguards
    SQL_MCP_TIMEOUT_SECONDS: int = 15
    SQL_MCP_MAX_ROWS: int = 200
    SQL_MCP_ALLOW_WRITE_TABLES: str = "articles,projects"

    @field_validator("DEBUG", mode="before")
    @classmethod
    def normalize_debug_flag(cls, value):
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"release", "prod", "production"}:
                return False
            if normalized in {"debug", "dev", "development"}:
                return True
        return value

    @field_validator("APP_ENV", mode="before")
    @classmethod
    def normalize_app_environment(cls, value):
        return str(value).strip().lower()

    @property
    def allowed_origins(self) -> list[str]:
        origins = []
        for origin in self.ALLOWED_ORIGINS.split(","):
            normalized = origin.strip().rstrip("/")
            if normalized and normalized not in origins:
                origins.append(normalized)
        return origins

    def validate_runtime(self) -> None:
        origins = self.allowed_origins
        if "*" in origins:
            raise RuntimeError("ALLOWED_ORIGINS cannot contain a wildcard when credentials are enabled.")
        if not origins:
            raise RuntimeError("ALLOWED_ORIGINS must contain at least one explicit origin.")

        if self.APP_ENV not in {"development", "test", "production"}:
            raise RuntimeError("APP_ENV must be development, test, or production.")

        if self.APP_ENV != "production":
            return

        required = {
            "PUBLIC_APP_URL": self.PUBLIC_APP_URL,
            "GOOGLE_CLIENT_ID": self.GOOGLE_CLIENT_ID,
            "SESSION_SECRET": self.SESSION_SECRET,
            "CREDENTIAL_ENCRYPTION_KEY": self.CREDENTIAL_ENCRYPTION_KEY,
        }
        missing = [name for name, value in required.items() if not value.strip()]

        if missing:
            names = ", ".join(missing)
            raise RuntimeError(
                f"Missing required production settings: {names}."
            )

        invalid = []
        if len(self.SESSION_SECRET) < 32:
            invalid.append("SESSION_SECRET")
        try:
            Fernet(self.CREDENTIAL_ENCRYPTION_KEY.encode("utf-8"))
        except (TypeError, ValueError):
            invalid.append("CREDENTIAL_ENCRYPTION_KEY")
        if invalid:
            names = ", ".join(invalid)
            raise RuntimeError(f"Invalid production security settings: {names}.")

        if not self.SESSION_COOKIE_SECURE:
            raise RuntimeError("SESSION_COOKIE_SECURE must be true in production.")
        if not self.PUBLIC_APP_URL.startswith("https://"):
            raise RuntimeError("PUBLIC_APP_URL must use HTTPS in production.")
        if self.PUBLIC_APP_URL.rstrip("/") not in origins:
            raise RuntimeError("PUBLIC_APP_URL must be present in ALLOWED_ORIGINS.")
    
@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
