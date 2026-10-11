"""Article CRUD use cases; transaction ownership remains with the caller."""

from app.services.article_import_service import (
    create_article_entity,
    evaluate_article_if_possible,
    resolve_paper_id,
)
from app.services.project_access_service import (
    CAP_EDIT_PROJECT,
    get_project_article,
    require_capability,
)
from app.services.review_workflow_service import apply_legacy_review_state


async def create_article(db, *, access, request, actor_user_id, ai_service=None):
    require_capability(access, CAP_EDIT_PROJECT)
    article = create_article_entity(
        payload=request,
        project_id=access.project.id,
        owner_id=actor_user_id,
        entry_method=request.entryMethod,
        source_category=request.sourceCategory,
        source_name=request.sourceName,
        import_batch_label=request.importBatchLabel,
        study_type=request.studyType,
    )
    await evaluate_article_if_possible(article, access.project, ai_service)
    db.add(article)
    await db.flush()
    return article


async def update_article(db, *, access, article_id, request, actor_user_id, ai_service=None):
    require_capability(access, CAP_EDIT_PROJECT)
    article = await get_project_article(db, project_id=access.project.id, article_id=article_id)
    changes = request.model_dump(exclude_unset=True)
    for name, value in changes.items():
        setattr(article, name, value)
    if any(name in changes for name in ("paperId", "doi", "title", "year")):
        article.paperId = resolve_paper_id(
            provided=article.paperId, doi=article.doi, title=article.title, year=article.year
        )
    if "abstract" in changes:
        await evaluate_article_if_possible(article, access.project, ai_service)
    apply_legacy_review_state(article)
    await db.flush()
    return article


async def delete_article(db, *, access, article_id, actor_user_id):
    require_capability(access, CAP_EDIT_PROJECT)
    article = await get_project_article(db, project_id=access.project.id, article_id=article_id)
    await db.delete(article)
    await db.flush()
    return article
