"""Apply migrations while safely adopting a compatible pre-Alembic database."""

import asyncio
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import settings
from app.database import Base
from app.models.article import Article  # noqa: F401
from app.models.project import Project  # noqa: F401
from app.models.user import User  # noqa: F401


BASELINE_REVISION = "0001_existing_schema"
BACKEND_ROOT = Path(__file__).resolve().parent


def _alembic_config(database_url: str) -> Config:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_ROOT / "migrations"))
    config.set_main_option("sqlalchemy.url", database_url)
    return config


def _inspect_schema(sync_connection) -> tuple[str, list[str]]:
    inspector = inspect(sync_connection)
    existing_tables = set(inspector.get_table_names())
    if "alembic_version" in existing_tables:
        return "versioned", []

    expected = {
        table.name: {column.name for column in table.columns}
        for table in Base.metadata.sorted_tables
    }
    present_managed_tables = existing_tables.intersection(expected)
    if not present_managed_tables:
        return "empty", []

    problems = []
    missing_tables = sorted(set(expected) - existing_tables)
    if missing_tables:
        problems.append(f"missing tables: {', '.join(missing_tables)}")

    for table_name in sorted(set(expected).intersection(existing_tables)):
        actual_columns = {
            column["name"] for column in inspector.get_columns(table_name)
        }
        missing_columns = sorted(expected[table_name] - actual_columns)
        if missing_columns:
            problems.append(
                f"{table_name} missing columns: {', '.join(missing_columns)}"
            )

    return ("incompatible" if problems else "legacy"), problems


async def _database_state(database_url: str) -> tuple[str, list[str]]:
    engine = create_async_engine(database_url)
    try:
        async with engine.connect() as connection:
            return await connection.run_sync(_inspect_schema)
    finally:
        await engine.dispose()


def run_migrations(database_url: str | None = None) -> None:
    url = database_url or settings.DATABASE_URL
    state, problems = asyncio.run(_database_state(url))
    config = _alembic_config(url)

    if state == "incompatible":
        details = "; ".join(problems)
        raise RuntimeError(f"Incompatible legacy schema; migration refused: {details}")
    if state == "legacy":
        print(f"Compatible legacy schema detected; stamping {BASELINE_REVISION}.")
        command.stamp(config, BASELINE_REVISION)

    command.upgrade(config, "head")


if __name__ == "__main__":
    run_migrations()
