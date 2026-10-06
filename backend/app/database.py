from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text

from app.config import settings


class Base(DeclarativeBase):
    pass


engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=25,
    max_overflow=30,
)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


def _alembic_head() -> str:
    backend_root = Path(__file__).resolve().parents[1]
    config = Config(str(backend_root / "alembic.ini"))
    config.set_main_option("script_location", str(backend_root / "migrations"))
    head = ScriptDirectory.from_config(config).get_current_head()
    if head is None:
        raise RuntimeError("Alembic has no configured head revision")
    return head


async def assert_database_revision(db_engine: AsyncEngine = engine) -> None:
    """Fail when the database schema is not at the application revision."""
    expected = _alembic_head()
    try:
        async with db_engine.connect() as connection:
            current = await connection.scalar(text("SELECT version_num FROM alembic_version"))
    except Exception as exc:
        raise RuntimeError(
            "Database revision is unavailable; run 'alembic upgrade head' before starting the API"
        ) from exc

    if current != expected:
        raise RuntimeError(
            f"Database revision mismatch: expected {expected!r}, found {current!r}"
        )


async def init_db() -> None:
    """Validate that deployment migrations ran before application startup."""
    await assert_database_revision()


async def get_db() -> AsyncSession:
    """Dependency to get database session."""
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()


async def db_health_check() -> dict:
    """Return DB connectivity status."""
    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        return {"connected": True}
    except Exception as exc:
        return {"connected": False, "error": str(exc)}
