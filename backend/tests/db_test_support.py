"""Safe helpers for disposable PostgreSQL databases used by integration tests."""

import os
import re
from uuid import uuid4

import asyncpg

TEST_DATABASE_PREFIX = "synapse_test_"
_DATABASE_RE = re.compile(r"^synapse_test_[a-z0-9_]{1,55}$")


def new_test_database(label: str) -> str:
    safe_label = re.sub(r"[^a-z0-9_]+", "_", label.lower()).strip("_")[:24]
    name = f"{TEST_DATABASE_PREFIX}{safe_label}_{uuid4().hex[:12]}"
    validate_test_database_name(name)
    return name


def validate_test_database_name(name: str) -> str:
    if not _DATABASE_RE.fullmatch(name):
        raise ValueError(f"Refusing to modify non-test database name: {name!r}")
    return name


def admin_database_url() -> str:
    return os.getenv(
        "TEST_DATABASE_ADMIN_URL",
        os.getenv(
            "MIGRATION_TEST_ADMIN_URL", "postgresql://synapse:synapse@localhost:5432/postgres"
        ),
    )


async def create_test_database(name: str) -> None:
    validate_test_database_name(name)
    connection = await asyncpg.connect(admin_database_url())
    try:
        await connection.execute(f'CREATE DATABASE "{name}"')
    finally:
        await connection.close()


async def drop_test_database(name: str) -> None:
    validate_test_database_name(name)
    connection = await asyncpg.connect(admin_database_url())
    try:
        await connection.execute(
            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
            "WHERE datname = $1 AND pid <> pg_backend_pid()",
            name,
        )
        await connection.execute(f'DROP DATABASE IF EXISTS "{name}"')
    finally:
        await connection.close()


def database_url_for_test(name: str) -> str:
    validate_test_database_name(name)
    base = os.getenv(
        "TEST_DATABASE_URL_BASE", "postgresql+asyncpg://synapse:synapse@localhost:5432"
    )
    return f"{base.rstrip('/')}/{name}"
