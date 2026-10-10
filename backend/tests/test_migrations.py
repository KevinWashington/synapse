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
from app.models.collaboration import (  # noqa: F401
    ProjectAuditEvent,
    ProjectInvitation,
    ProjectMember,
    ProjectNotification,
    ReviewAssignment,
    ReviewConflict,
    ReviewDecision,
)
from app.models.project import Project  # noqa: F401
from app.models.synthesis import RQSynthesis, SynthesisGenerationJob  # noqa: F401
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


def _run_migration_runner() -> subprocess.CompletedProcess[str]:
    environment = os.environ.copy()
    environment["DATABASE_URL"] = TEST_DATABASE_URL
    return subprocess.run(
        [sys.executable, "migrate_database.py"],
        cwd=BACKEND_ROOT,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )


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
                        for table in (
                            "users",
                            "projects",
                            "articles",
                            "project_members",
                            "project_invitations",
                            "review_assignments",
                            "review_decisions",
                            "review_conflicts",
                            "project_notifications",
                            "project_audit_events",
                            "rq_syntheses",
                            "synthesis_generation_jobs",
                        )
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
        "project_members",
        "project_invitations",
        "review_assignments",
        "review_decisions",
        "review_conflicts",
        "project_notifications",
        "project_audit_events",
        "rq_syntheses",
        "synthesis_generation_jobs",
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
    assert {"projectId", "userId", "role", "status", "participatesInReview"} <= columns["project_members"]
    assert {"projectId", "emailNormalized", "role", "status", "expiresAt"} <= columns["project_invitations"]
    assert {"articleId", "phase", "reviewerUserId", "slot", "status"} <= columns["review_assignments"]
    assert {"assignmentId", "decision", "status", "submittedAt"} <= columns["review_decisions"]
    assert {"articleId", "phase", "status", "resolvedDecision"} <= columns["review_conflicts"]
    assert {"recipientUserId", "type", "readAt", "payload"} <= columns["project_notifications"]
    assert {"actorUserId", "action", "entityType", "reason", "payload"} <= columns["project_audit_events"]
    assert {"projectId", "rqNumber", "questionSnapshot", "content", "version"} <= columns["rq_syntheses"]
    assert {"projectId", "rqNumber", "requesterUserId", "idempotencyKey", "status"} <= columns["synthesis_generation_jobs"]


def test_synthesis_revision_can_be_downgraded_and_reapplied():
    command.upgrade(_config(), "head")
    command.downgrade(_config(), "0004_inbox_invite_consent")

    async def synthesis_tables_exist() -> bool:
        engine = create_async_engine(TEST_DATABASE_URL)
        try:
            async with engine.connect() as connection:
                tables = await connection.run_sync(lambda sync: set(inspect(sync).get_table_names()))
                return {"rq_syntheses", "synthesis_generation_jobs"} <= tables
        finally:
            await engine.dispose()

    assert asyncio.run(synthesis_tables_exist()) is False
    command.upgrade(_config(), "head")
    assert asyncio.run(synthesis_tables_exist()) is True


def test_collaboration_constraints_and_partial_indexes():
    command.upgrade(_config(), "head")

    async def inspect_constraints():
        engine = create_async_engine(TEST_DATABASE_URL)
        try:
            async with engine.connect() as connection:
                return await connection.run_sync(
                    lambda sync_connection: {
                        "member_unique": inspect(sync_connection).get_unique_constraints("project_members"),
                        "assignment_checks": inspect(sync_connection).get_check_constraints("review_assignments"),
                        "invitation_indexes": inspect(sync_connection).get_indexes("project_invitations"),
                        "assignment_indexes": inspect(sync_connection).get_indexes("review_assignments"),
                        "decision_indexes": inspect(sync_connection).get_indexes("review_decisions"),
                        "conflict_indexes": inspect(sync_connection).get_indexes("review_conflicts"),
                    }
                )
        finally:
            await engine.dispose()

    state = asyncio.run(inspect_constraints())
    assert any(set(item["column_names"]) == {"projectId", "userId"} for item in state["member_unique"])
    assert {item["name"] for item in state["assignment_checks"]} >= {
        "ck_review_assignments_phase",
        "ck_review_assignments_slot",
        "ck_review_assignments_status",
    }
    assert any(item["name"] == "uq_project_invitations_pending" and item["unique"] for item in state["invitation_indexes"])
    assert any(item["name"] == "uq_review_assignments_active_slot" and item["unique"] for item in state["assignment_indexes"])
    assert any(item["name"] == "uq_review_decisions_current" and item["unique"] for item in state["decision_indexes"])
    assert any(item["name"] == "uq_review_conflicts_open" and item["unique"] for item in state["conflict_indexes"])


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


def test_migration_runner_stamps_compatible_legacy_schema():
    command.upgrade(_config(), "0001_existing_schema")

    async def make_schema_legacy() -> None:
        engine = create_async_engine(TEST_DATABASE_URL)
        try:
            async with engine.begin() as connection:
                await connection.execute(
                    text(
                        'INSERT INTO users (name, email, "passwordHash", role, "isActive", "createdAt", "updatedAt") '
                        "VALUES ('Preserved', 'preserved@example.com', 'hash', 'user', true, now(), now())"
                    )
                )
                await connection.execute(text("DROP TABLE alembic_version"))
        finally:
            await engine.dispose()

    asyncio.run(make_schema_legacy())
    result = _run_migration_runner()

    assert result.returncode == 0, result.stdout + result.stderr

    async def preserved_state() -> tuple[str | None, int]:
        engine = create_async_engine(TEST_DATABASE_URL)
        try:
            async with engine.connect() as connection:
                revision = await connection.scalar(text("SELECT version_num FROM alembic_version"))
                users = await connection.scalar(text("SELECT count(*) FROM users"))
                return revision, int(users)
        finally:
            await engine.dispose()

    assert asyncio.run(preserved_state()) == ("0005_evidence_synthesis", 1)


def test_migration_runner_rejects_partial_legacy_schema():
    async def create_partial_schema() -> None:
        engine = create_async_engine(TEST_DATABASE_URL)
        try:
            async with engine.begin() as connection:
                await connection.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY)"))
        finally:
            await engine.dispose()

    asyncio.run(create_partial_schema())
    result = _run_migration_runner()

    assert result.returncode != 0
    assert "incompatible legacy schema" in (result.stdout + result.stderr).lower()
