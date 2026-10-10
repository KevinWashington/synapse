import hashlib
import unicodedata

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article
from app.models.project import Project
from app.models.synthesis import RQSynthesis


def normalize_question(text: str) -> str:
    normalized = unicodedata.normalize("NFC", text or "")
    return " ".join(normalized.split()).casefold()


def question_fingerprint(text: str) -> str:
    return hashlib.sha256(normalize_question(text).encode("utf-8")).hexdigest()


async def reconcile_research_questions(
    db: AsyncSession,
    *,
    project: Project,
    previous: list[str],
    current: list[str],
) -> None:
    """Keep synthesis rows and final article links attached to their question."""
    locked_project = await db.scalar(
        select(Project)
        .where(Project.id == project.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if locked_project is None:
        return

    old_questions = list(locked_project.researchQuestions or previous or [])
    new_questions = list(current or [])
    if old_questions == new_questions:
        return

    result = await db.execute(
        select(RQSynthesis)
        .where(RQSynthesis.projectId == project.id, RQSynthesis.rqNumber.is_not(None))
        .order_by(RQSynthesis.rqNumber)
        .with_for_update()
    )
    drafts = result.scalars().all()

    # Match exact snapshots first. Ordering by the old position resolves identical
    # question text by occurrence, as it does in the Planning editor.
    available_by_fingerprint: dict[str, list[RQSynthesis]] = {}
    original_positions: dict[int, int] = {}
    for draft in drafts:
        original_positions[draft.id] = draft.rqNumber
        available_by_fingerprint.setdefault(draft.questionFingerprint, []).append(draft)

    desired_positions: dict[int, int] = {}
    occupied_positions: set[int] = set()
    old_to_new: dict[int, int] = {}
    for new_position, question in enumerate(new_questions, start=1):
        candidates = available_by_fingerprint.get(question_fingerprint(question), [])
        while candidates and candidates[0].id in desired_positions:
            candidates.pop(0)
        if candidates:
            draft = candidates.pop(0)
            desired_positions[draft.id] = new_position
            occupied_positions.add(new_position)

    # If a question was edited in place, leave its old draft at that position so
    # the detail query can expose it only as a stale candidate.
    by_original_position = {original_positions[draft.id]: draft for draft in drafts}
    for old_position, draft in by_original_position.items():
        if draft.id in desired_positions or old_position > len(new_questions):
            continue
        if old_position not in occupied_positions:
            desired_positions[draft.id] = old_position
            occupied_positions.add(old_position)

    # Final article links follow question text even when no synthesis draft
    # exists for that question. Repeated text is matched by occurrence order.
    new_positions_by_fingerprint: dict[str, list[int]] = {}
    for new_position, question in enumerate(new_questions, start=1):
        new_positions_by_fingerprint.setdefault(question_fingerprint(question), []).append(new_position)
    for old_position, question in enumerate(old_questions, start=1):
        candidates = new_positions_by_fingerprint.get(question_fingerprint(question), [])
        if candidates:
            old_to_new[old_position] = candidates.pop(0)
    occupied_link_targets = set(old_to_new.values())
    for old_position in range(1, min(len(old_questions), len(new_questions)) + 1):
        if old_position not in old_to_new and old_position not in occupied_link_targets:
            old_to_new[old_position] = old_position
            occupied_link_targets.add(old_position)

    # Releasing active positions first avoids unique-index collisions during swaps.
    for draft in drafts:
        draft.rqNumber = None
    await db.flush()

    for draft in drafts:
        draft.rqNumber = desired_positions.get(draft.id)
    await db.flush()

    # Remap only current final links. AI suggestions and review-decision history
    # stay untouched; position fallback preserves links for in-place edits.
    article_rows = await db.execute(
        select(Article.id, Article.answeringRQs).where(Article.projectId == project.id)
    )
    for article_id, linked_questions in article_rows:
        remapped = sorted({old_to_new[number] for number in (linked_questions or []) if number in old_to_new})
        if remapped != sorted(set(linked_questions or [])):
            await db.execute(
                update(Article)
                .where(Article.id == article_id)
                .values(answeringRQs=remapped)
            )

    locked_project.researchQuestions = new_questions
    project.researchQuestions = new_questions
