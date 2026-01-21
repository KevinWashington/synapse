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
    
    # Server
    PORT: int = 5000
    DEBUG: bool = False
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
