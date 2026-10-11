import asyncio

import pytest
from alembic import command
from app.models.user import User
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import create_async_engine

from test_migrations import TEST_DATABASE_URL, _config


def test_user_model_exposes_google_and_encrypted_key_fields():
    columns = User.__table__.columns

    assert columns["passwordHash"].nullable is True
    assert columns["googleSub"].nullable is True
    assert columns["deepseekKeyCiphertext"].nullable is True
    assert columns["deepseekKeyVersion"].nullable is True
    assert columns["deepseekKeyLastFour"].nullable is True
    assert columns["deepseekKeyUpdatedAt"].nullable is True


@pytest.mark.usefixtures("migration_database")
def test_auth_migration_preserves_existing_user_project_ownership():
    command.upgrade(_config(), "0001_existing_schema")

    async def seed_legacy_data() -> tuple[int, int]:
        engine = create_async_engine(TEST_DATABASE_URL)
        try:
            async with engine.begin() as connection:
                user_id = await connection.scalar(
                    text(
                        'INSERT INTO users (name, email, "passwordHash", role, "isActive", "createdAt", "updatedAt") '
                        "VALUES ('Legacy', 'legacy@example.com', 'hash', 'user', true, now(), now()) RETURNING id"
                    )
                )
                project_id = await connection.scalar(
                    text(
                        'INSERT INTO projects (title, objetivo, status, framework, "ownerId", "createdAt", "updatedAt") '
                        "VALUES ('Owned', 'Keep ownership', 'ideia', 'PICOC', :owner_id, now(), now()) RETURNING id"
                    ),
                    {"owner_id": user_id},
                )
                return int(user_id), int(project_id)
        finally:
            await engine.dispose()

    ids = asyncio.run(seed_legacy_data())
    command.upgrade(_config(), "head")

    async def migrated_state():
        engine = create_async_engine(TEST_DATABASE_URL)
        try:
            async with engine.connect() as connection:
                owner_id = await connection.scalar(
                    text('SELECT "ownerId" FROM projects WHERE id = :id'),
                    {"id": ids[1]},
                )
                columns = await connection.run_sync(
                    lambda sync_connection: {
                        column["name"] for column in inspect(sync_connection).get_columns("users")
                    }
                )
                return int(owner_id), columns
        finally:
            await engine.dispose()

    owner_id, columns = asyncio.run(migrated_state())
    assert owner_id == ids[0]
    assert {
        "googleSub",
        "deepseekKeyCiphertext",
        "deepseekKeyVersion",
        "deepseekKeyLastFour",
        "deepseekKeyUpdatedAt",
    } <= columns


@pytest.mark.usefixtures("migration_database")
def test_google_sub_is_unique_when_present():
    command.upgrade(_config(), "head")

    async def insert_duplicate_subjects() -> None:
        engine = create_async_engine(TEST_DATABASE_URL)
        try:
            async with engine.begin() as connection:
                await connection.execute(
                    text(
                        'INSERT INTO users (name, email, "googleSub", role, "isActive", "createdAt", "updatedAt") '
                        "VALUES ('One', 'one@example.com', 'google-123', 'user', true, now(), now())"
                    )
                )
            with pytest.raises(IntegrityError):
                async with engine.begin() as connection:
                    await connection.execute(
                        text(
                            'INSERT INTO users (name, email, "googleSub", role, "isActive", "createdAt", "updatedAt") '
                            "VALUES ('Two', 'two@example.com', 'google-123', 'user', true, now(), now())"
                        )
                    )
        finally:
            await engine.dispose()

    asyncio.run(insert_duplicate_subjects())
