import asyncio

import pytest
import pytest_asyncio
from app.database import Base
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from db_test_support import (
    create_test_database,
    database_url_for_test,
    drop_test_database,
    new_test_database,
)

SYNTHESIS_TEST_DATABASE = new_test_database("synthesis_identity")
SYNTHESIS_TEST_URL = database_url_for_test(SYNTHESIS_TEST_DATABASE)


@pytest.fixture(scope="module")
def synthesis_database():
    async def reset(create: bool) -> None:
        if create:
            await create_test_database(SYNTHESIS_TEST_DATABASE)
            engine = create_async_engine(SYNTHESIS_TEST_URL)
            try:
                async with engine.begin() as connection:
                    await connection.run_sync(Base.metadata.create_all)
            finally:
                await engine.dispose()
        else:
            await drop_test_database(SYNTHESIS_TEST_DATABASE)

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
