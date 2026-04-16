import argparse
import asyncio

from sqlalchemy import select

from app.database import async_session_maker
from app.models.article import Article  # noqa: F401
from app.models.project import Project
from app.models.user import User  # noqa: F401


LEGACY_TO_CANONICAL = {
    "pessoa": "population",
    "intervencao": "intervention",
    "comparacao": "comparison",
    "contexto": "context",
}


def migrate_picoc_payload(payload: dict | None) -> tuple[dict, bool]:
    if not isinstance(payload, dict):
        return {}, False

    migrated = dict(payload)
    changed = False

    for legacy_key, canonical_key in LEGACY_TO_CANONICAL.items():
        if legacy_key in migrated:
            if canonical_key not in migrated and migrated.get(legacy_key) not in (None, ""):
                migrated[canonical_key] = migrated[legacy_key]
            del migrated[legacy_key]
            changed = True

    return migrated, changed


async def run_migration(apply_changes: bool) -> None:
    async with async_session_maker() as session:
        result = await session.execute(select(Project))
        projects = result.scalars().all()

        changed_projects = 0
        for project in projects:
            migrated_picoc, changed = migrate_picoc_payload(project.picoc)
            if not changed:
                continue

            changed_projects += 1
            print(f"Projeto {project.id} ({project.title}): picoc legado detectado")

            if apply_changes:
                project.picoc = migrated_picoc

        if apply_changes:
            await session.commit()
            print(f"Migracao concluida: {changed_projects} projeto(s) atualizado(s).")
        else:
            await session.rollback()
            print(f"Dry-run concluido: {changed_projects} projeto(s) seriam atualizados.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Migra chaves legadas de PICOC para o formato canonico em ingles."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Aplica as alteracoes no banco. Sem esta flag, executa apenas dry-run.",
    )
    args = parser.parse_args()

    asyncio.run(run_migration(apply_changes=args.apply))
