"""Shared test marker registration and import-boundary checks."""

import asyncio
from urllib.parse import urlparse

import pytest

from db_test_support import (
    create_test_database,
    drop_test_database,
    validate_test_database_name,
)

pytest_plugins = ()


def pytest_configure(config):
    config.addinivalue_line("markers", "unit: no external services required")
    config.addinivalue_line("markers", "integration: requires isolated external services")


def pytest_collection_modifyitems(items):
    database_fixtures = {
        "database",
        "assignment_database",
        "synthesis_database",
        "migration_database",
        "index_db",
    }
    for item in items:
        if item.get_closest_marker("unit") or item.get_closest_marker("integration"):
            continue
        marker = (
            pytest.mark.integration
            if database_fixtures.intersection(item.fixturenames)
            else pytest.mark.unit
        )
        item.add_marker(marker)


@pytest.fixture
def migration_database(request):
    name = getattr(request.module, "TEST_DATABASE", None)
    if name is None:
        name = validate_test_database_name(
            urlparse(request.module.TEST_DATABASE_URL).path.lstrip("/")
        )
    asyncio.run(drop_test_database(name))
    asyncio.run(create_test_database(name))
    yield
    asyncio.run(drop_test_database(name))
