"""Seed fixed Playwright actors and local sessions in a disposable database only."""

import asyncio
import json
from pathlib import Path

from sqlalchemy import select

from app.config import settings
from app.core.security import create_session_token
from app.database import async_session_maker
from app.models.user import User

ACTORS = [
    (1, "Owner Refactor", "owner.refactor@example.com", "E2E_SESSION_TOKEN"),
    (2, "Test User", "test@example.com", "E2E_REVIEWER_TOKEN"),
    (3, "Peer Refactor", "avaliador.pa1@gmail.com", "E2E_PEER_TOKEN"),
    (4, "Coordinator Refactor", "colega.revisor@example.com", "E2E_COORDINATOR_TOKEN"),
]


async def main():
    if settings.APP_ENV != "test" or not settings.DATABASE_URL.endswith("/synapse_refactor_test"):
        raise RuntimeError("Seeding requires the dedicated synapse_refactor_test database")
    async with async_session_maker() as db:
        for user_id, name, email, _ in ACTORS:
            user = await db.get(User, user_id)
            if user and user.email != email:
                raise RuntimeError("Refusing to overwrite an unrelated user")
            other = await db.scalar(select(User).where(User.email == email))
            if other and other.id != user_id:
                raise RuntimeError("E2E actor IDs do not match this database")
            if user:
                user.name = name
            else:
                db.add(User(id=user_id, name=name, email=email, isActive=True))
        await db.commit()
    sessions = {key: create_session_token(user_id) for user_id, _, _, key in ACTORS}
    Path(".e2e-sessions.json").write_text(json.dumps(sessions), encoding="utf-8")
    print("Four test sessions written to ignored .e2e-sessions.json")


if __name__ == "__main__":
    asyncio.run(main())
