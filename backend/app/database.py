from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text

from app.config import settings


class Base(DeclarativeBase):
    pass


engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def init_db():
    """Create all tables on startup and run migrations."""
    async with engine.begin() as conn:
        # Enable pgvector extension for embedding support
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
        
        # Migration: add framework column to existing projects
        await conn.execute(text(
            "ALTER TABLE projects ADD COLUMN IF NOT EXISTS framework VARCHAR(10) DEFAULT 'PICOC' NOT NULL"
        ))
        await conn.execute(text(
            "UPDATE projects SET framework = 'PICOC' WHERE framework IS NULL"
        ))


async def get_db() -> AsyncSession:
    """Dependency to get database session."""
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()
