"""Local-only Playwright fixture for the Google-login invitation claim boundary."""

import argparse
import asyncio
import json

from sqlalchemy import func, select

from app.core.security import create_session_token
from app.database import async_session_maker, engine
from app.models.user import User
from app.services.invitation_service import claim_pending_invitations


async def claim(email: str, name: str) -> None:
    normalized = email.strip().lower()
    async with async_session_maker() as db:
        result = await db.execute(
            select(User).where(func.lower(func.trim(User.email)) == normalized)
        )
        user = result.scalar_one_or_none()
        if user is None:
            user = User(
                name=name,
                email=normalized,
                googleSub=f"playwright:{normalized}",
                role="user",
                isActive=True,
            )
            db.add(user)
            await db.flush()
        else:
            user.name = name
            user.isActive = True
            user.googleSub = user.googleSub or f"playwright:{normalized}"

        memberships = await claim_pending_invitations(db, user=user)
        await db.commit()
        print(json.dumps({
            "userId": user.id,
            "token": create_session_token(user.id),
            "claimedProjectIds": [member.projectId for member in memberships],
        }))
    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", default="Convidado Playwright")
    args = parser.parse_args()
    asyncio.run(claim(args.email, args.name))


if __name__ == "__main__":
    main()
