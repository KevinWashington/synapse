from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://synapse:synapse@localhost:5432/synapse"
    
    # JWT
    JWT_SECRET: str = "change_this_secret_in_production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 10080  # 7 days
    
    # Google Gemini
    GOOGLE_API_KEY: str = ""
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
    RETRIEVAL_BACKEND: str = "pgvector"
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_COLLECTION: str = "articles"

    # PostgreSQL MCP safeguards
    SQL_MCP_TIMEOUT_SECONDS: int = 15
    SQL_MCP_MAX_ROWS: int = 200
    SQL_MCP_ALLOW_WRITE_TABLES: str = "articles,projects"

    def validate_runtime(self) -> None:
        missing = []
        if not self.GOOGLE_API_KEY:
            missing.append("GOOGLE_API_KEY")
        if not self.HF_TOKEN:
            missing.append("HF_TOKEN")

        if missing:
            names = ", ".join(missing)
            raise RuntimeError(
                f"Missing required environment variables: {names}. "
                "Set them in backend/.env before starting the API."
            )
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
