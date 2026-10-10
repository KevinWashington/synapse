import asyncio

import asyncpg
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.database import Base


SYNTHESIS_TEST_DATABASE = "synapse_synthesis_identity_test"
SYNTHESIS_TEST_URL = f"postgresql+asyncpg://synapse:synapse@localhost:5432/{SYNTHESIS_TEST_DATABASE}"


@pytest.fixture(scope="module")
def synthesis_database():
    async def reset(create: bool) -> None:
        connection = await asyncpg.connect("postgresql://synapse:synapse@localhost:5432/postgres")
        try:
            await connection.execute(
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                "WHERE datname = $1 AND pid <> pg_backend_pid()",
                SYNTHESIS_TEST_DATABASE,
            )
            await connection.execute(f'DROP DATABASE IF EXISTS "{SYNTHESIS_TEST_DATABASE}"')
            if create:
                await connection.execute(f'CREATE DATABASE "{SYNTHESIS_TEST_DATABASE}"')
        finally:
            await connection.close()

        if create:
            engine = create_async_engine(SYNTHESIS_TEST_URL)
            try:
                async with engine.begin() as connection:
                    await connection.run_sync(Base.metadata.create_all)
            finally:
                await engine.dispose()

    asyncio.run(reset(True))
    yield SYNTHESIS_TEST_URL
    asyncio.run(reset(False))


@pytest_asyncio.fixture
async def synthesis_session(synthesis_database):
    engine = create_async_engine(synthesis_database)
    async with engine.connect() as connection:
        transaction = await connection.begin()
        async with AsyncSession(
            bind=connection,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        ) as session:
            yield session
        await transaction.rollback()
    await engine.dispose()
