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

        # Migration: add canonical paperId anchor to articles
        await conn.execute(text(
            'ALTER TABLE articles ADD COLUMN IF NOT EXISTS "paperId" VARCHAR(120)'
        ))
        await conn.execute(text(
            """
            UPDATE articles
            SET "paperId" = COALESCE(
                NULLIF(BTRIM(REGEXP_REPLACE(LOWER(COALESCE(doi, '')), '[^a-z0-9]+', '-', 'g'), '-'), ''),
                'paper-' || SUBSTRING(MD5(COALESCE(title, '') || '-' || COALESCE(year::text, '') || '-' || id::text), 1, 16)
            )
            WHERE "paperId" IS NULL OR "paperId" = ''
            """
        ))
        await conn.execute(text(
            'CREATE INDEX IF NOT EXISTS idx_articles_paperid ON articles ("paperId")'
        ))
        await conn.execute(text(
            'CREATE INDEX IF NOT EXISTS idx_articles_project_paperid ON articles ("projectId", "paperId")'
        ))

        # Migration: add screening and traceability columns to articles
        await conn.execute(text(
            'ALTER TABLE articles ADD COLUMN IF NOT EXISTS "manualDecision" VARCHAR(20)'
        ))
        await conn.execute(text(
            'ALTER TABLE articles ADD COLUMN IF NOT EXISTS "manualDecisionReason" TEXT'
        ))
        await conn.execute(text(
            'ALTER TABLE articles ADD COLUMN IF NOT EXISTS "exclusionCriteria" TEXT[] DEFAULT ARRAY[]::TEXT[]'
        ))
        await conn.execute(text(
            'ALTER TABLE articles ADD COLUMN IF NOT EXISTS "answeringRQs" INTEGER[] DEFAULT ARRAY[]::INTEGER[]'
        ))
        await conn.execute(text(
            'ALTER TABLE articles ADD COLUMN IF NOT EXISTS "aiSuggestedRQs" INTEGER[] DEFAULT ARRAY[]::INTEGER[]'
        ))
        await conn.execute(text(
            'ALTER TABLE articles ADD COLUMN IF NOT EXISTS "decisionUpdatedAt" TIMESTAMP WITH TIME ZONE'
        ))


async def get_db() -> AsyncSession:
    """Dependency to get database session."""
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()


async def db_health_check() -> dict:
    """Return DB connectivity and pgvector extension status."""
    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
            vector_enabled = await conn.scalar(
                text("SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='vector')")
            )
        return {
            "connected": True,
            "vectorExtension": bool(vector_enabled),
        }
    except Exception as exc:
        return {
            "connected": False,
            "vectorExtension": False,
            "error": str(exc),
        }
