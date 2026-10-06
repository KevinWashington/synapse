import asyncio
import os
import subprocess
import sys
from pathlib import Path

import asyncpg
import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import create_async_engine

from app.database import Base, assert_database_revision
from app.models.article import Article  # noqa: F401
from app.models.project import Project  # noqa: F401
from app.models.user import User  # noqa: F401


BACKEND_ROOT = Path(__file__).resolve().parents[1]
TEST_DATABASE = "synapse_migration_test"
ADMIN_URL = os.getenv(
    "MIGRATION_TEST_ADMIN_URL",
    "postgresql://synapse:synapse@localhost:5432/postgres",
)
TEST_DATABASE_URL = os.getenv(
    "MIGRATION_TEST_DATABASE_URL",
    f"postgresql+asyncpg://synapse:synapse@localhost:5432/{TEST_DATABASE}",
)


async def _reset_database() -> None:
    connection = await asyncpg.connect(ADMIN_URL)
    try:
        await connection.execute(
            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
            "WHERE datname = $1 AND pid <> pg_backend_pid()",
            TEST_DATABASE,
        )
        await connection.execute(f'DROP DATABASE IF EXISTS "{TEST_DATABASE}"')
        await connection.execute(f'CREATE DATABASE "{TEST_DATABASE}"')
    finally:
        await connection.close()


@pytest.fixture(autouse=True)
def migration_database():
    asyncio.run(_reset_database())
    yield
    asyncio.run(_reset_database())


def _config() -> Config:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_ROOT / "migrations"))
    config.set_main_option("sqlalchemy.url", TEST_DATABASE_URL)
    return config


async def _schema_snapshot() -> tuple[set[str], dict[str, set[str]]]:
    engine = create_async_engine(TEST_DATABASE_URL)
    try:
        async with engine.connect() as connection:
            return await connection.run_sync(
                lambda sync_connection: (
                    set(inspect(sync_connection).get_table_names()),
                    {
                        table: {
                            column["name"]
                            for column in inspect(sync_connection).get_columns(table)
                        }
                        for table in ("users", "projects", "articles")
                    },
                )
            )
    finally:
        await engine.dispose()


def test_empty_database_upgrades_to_baseline_schema():
    command.upgrade(_config(), "head")

    tables, columns = asyncio.run(_schema_snapshot())

    assert {
        "alembic_version",
        "users",
        "projects",
        "articles",
        "articleRelationships",
    } <= tables
    assert {"id", "email", "passwordHash", "isActive"} <= columns["users"]
    assert {
        "framework",
        "dataExtractionSchema",
        "qualityAssessmentSchema",
        "ownerId",
    } <= columns["projects"]
    assert {
        "paperId",
        "manualDecision",
        "answeringRQs",
        "extractionData",
        "qualityAssessmentAnswers",
        "projectId",
        "ownerId",
    } <= columns["articles"]


def test_baseline_matches_application_model_metadata():
    command.upgrade(_config(), "head")

    environment = os.environ.copy()
    environment["DATABASE_URL"] = TEST_DATABASE_URL
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "-c", "alembic.ini", "check"],
        cwd=BACKEND_ROOT,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stdout + result.stderr


def test_legacy_database_can_be_stamped_without_row_loss():
    async def create_legacy_rows() -> None:
        engine = create_async_engine(TEST_DATABASE_URL)
        try:
            async with engine.begin() as connection:
                await connection.run_sync(Base.metadata.create_all)
                await connection.execute(
                    text(
                        'INSERT INTO users (name, email, "passwordHash", role, "isActive", "createdAt", "updatedAt") '
                        "VALUES ('Legacy User', 'legacy@example.com', 'hash', 'user', true, now(), now())"
                    )
                )
                await connection.execute(
                    text(
                        'INSERT INTO projects (title, objetivo, status, framework, "ownerId", "createdAt", "updatedAt") '
                        "VALUES ('Legacy Project', 'Preserve me', 'ideia', 'PICOC', 1, now(), now())"
                    )
                )
        finally:
            await engine.dispose()

    asyncio.run(create_legacy_rows())
    command.stamp(_config(), "head")

    async def counts() -> tuple[int, int]:
        engine = create_async_engine(TEST_DATABASE_URL)
        try:
            async with engine.connect() as connection:
                users = await connection.scalar(text("SELECT count(*) FROM users"))
                projects = await connection.scalar(text("SELECT count(*) FROM projects"))
                return int(users), int(projects)
        finally:
            await engine.dispose()

    assert asyncio.run(counts()) == (1, 1)


def test_database_revision_mismatch_is_reported():
    command.upgrade(_config(), "head")

    async def corrupt_and_check() -> None:
        engine = create_async_engine(TEST_DATABASE_URL)
        try:
            async with engine.begin() as connection:
                await connection.execute(
                    text("UPDATE alembic_version SET version_num = 'not_the_head'")
                )
            with pytest.raises(RuntimeError, match="revision"):
                await assert_database_revision(engine)
        finally:
            await engine.dispose()

    asyncio.run(corrupt_and_check())
