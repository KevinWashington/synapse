from sqlalchemy import select

from app.models.project import Project


async def lock_project_team(db, project_id):
    """Serialize team mutations and adaptation before taking assignment locks.

    Refresh the ORM identity after waiting, notably for ownership changes.
    The lock is held until the surrounding transaction commits or rolls back.
    """
    await db.execute(select(Project).where(Project.id == project_id)
                     .with_for_update(key_share=True).execution_options(populate_existing=True))
