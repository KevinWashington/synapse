from functools import lru_cache
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
    
    # JWT
    JWT_SECRET: str = "change_this_secret_in_production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 10080  # 7 days
    
    # DeepSeek
    DEEPSEEK_API_KEY: str = ""
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

    def validate_runtime(self) -> None:
        missing = []
        if not self.DEEPSEEK_API_KEY:
            missing.append("DEEPSEEK_API_KEY")
        if not self.HF_TOKEN:
            missing.append("HF_TOKEN")

        if missing:
            names = ", ".join(missing)
            raise RuntimeError(
                f"Missing required environment variables: {names}. "
                "Set them in backend/.env before starting the API."
            )
    
@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
