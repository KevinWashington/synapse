import json

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.synthesis import RQSynthesis, SynthesisGenerationJob
from app.models.user import User
from app.schemas.synthesis import GenerationRequest, ManualSynthesisUpdate
from app.services.project_access_service import CAP_EDIT_PROJECT, CAP_READ_PROJECT, require_capability, resolve_project_access
from app.services.synthesis_export_service import csv_row, iter_json_report, iter_matrix_rows
from app.services.synthesis_jobs_service import SynthesisConflict, cancel_generation, enqueue_generation, save_manual_draft
from app.services.synthesis_query_service import (
    DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, get_chart, get_chart_catalog, get_matrix_article, get_overview,
    get_quality_criteria, get_quality_study, get_rq_detail, list_evidence, list_matrix,
    list_quality_studies, list_rqs,
)

router = APIRouter()


async def _access(db, project_id, user, capability=CAP_READ_PROJECT):
    access = await resolve_project_access(db, project_id=project_id, user_id=user.id)
    require_capability(access, capability)
    return access


def _filters(search, rq_number, year_from, year_to, source, quality_rating, completion):
    return {key: value for key, value in {
        "search": search, "rqNumber": rq_number, "yearFrom": year_from, "yearTo": year_to,
        "source": source, "qualityRating": quality_rating, "completion": completion,
    }.items() if value is not None}


def _conflict(exc):
    return HTTPException(status_code=409, detail={"code": "SYNTHESIS_VERSION_CONFLICT", "message": str(exc)})


@router.get("/{projectId}/synthesis/overview")
async def overview(projectId: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await _access(db, projectId, current_user)
    return await get_overview(db, access.project)


@router.get("/{projectId}/synthesis/rqs")
async def rqs(projectId: int, search: str | None = None, state: str | None = None, page: int = Query(1, ge=1), pageSize: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE), current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await _access(db, projectId, current_user)
    return await list_rqs(db, access.project, search=search, state=state, page=page, page_size=pageSize)


@router.get("/{projectId}/synthesis/rqs/{rqNumber}")
async def rq_detail(projectId: int, rqNumber: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await _access(db, projectId, current_user)
    detail = await get_rq_detail(db, access.project, rqNumber)
    if detail is None:
        raise HTTPException(404, detail={"code": "RQ_NOT_FOUND"})
    detail["activeGeneration"] = None
    result = await db.execute(select(SynthesisGenerationJob).where(SynthesisGenerationJob.projectId == projectId, SynthesisGenerationJob.rqNumber == rqNumber, SynthesisGenerationJob.status.in_(("queued", "running"))))
    job = result.scalar_one_or_none()
    if job:
        detail["activeGeneration"] = _job_payload(job)
    return detail


def _job_payload(job):
    return {"id": job.id, "rqNumber": job.rqNumber, "status": job.status, "completedBatches": job.completedBatches, "totalBatches": job.totalBatches, "errorCode": job.errorCode}


@router.get("/{projectId}/synthesis/rqs/{rqNumber}/evidence")
async def evidence(projectId: int, rqNumber: int, search: str | None = None, yearFrom: int | None = None, yearTo: int | None = None, source: str | None = None, qualityRating: str | None = None, completion: str | None = None, page: int = Query(1, ge=1), pageSize: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE), order: str = "quality", current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await _access(db, projectId, current_user)
    return await list_evidence(db, access.project, rqNumber, _filters(search, rqNumber, yearFrom, yearTo, source, qualityRating, completion), page=page, page_size=pageSize, order=order)


@router.get("/{projectId}/synthesis/matrix")
async def matrix(projectId: int, search: str | None = None, rqNumber: int | None = None, yearFrom: int | None = None, yearTo: int | None = None, source: str | None = None, qualityRating: str | None = None, completion: str | None = None, page: int = Query(1, ge=1), pageSize: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE), columns: list[str] | None = Query(None), current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await _access(db, projectId, current_user)
    return await list_matrix(db, access.project, _filters(search, rqNumber, yearFrom, yearTo, source, qualityRating, completion), page=page, page_size=pageSize, columns=columns)


@router.get("/{projectId}/synthesis/matrix/{articleId}")
async def matrix_article(projectId: int, articleId: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await _access(db, projectId, current_user)
    article = await get_matrix_article(db, access.project, articleId)
    if article is None:
        raise HTTPException(404, detail={"code": "SYNTHESIS_ARTICLE_NOT_FOUND"})
    return article


@router.get("/{projectId}/synthesis/charts")
async def charts(projectId: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await _access(db, projectId, current_user)
    return await get_chart_catalog(db, access.project)


@router.get("/{projectId}/synthesis/charts/{chartKey}")
async def chart(projectId: int, chartKey: str, search: str | None = None, rqNumber: int | None = None, yearFrom: int | None = None, yearTo: int | None = None, source: str | None = None, page: int = Query(1, ge=1), pageSize: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE), current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await _access(db, projectId, current_user)
    return await get_chart(db, access.project, chartKey, _filters(search, rqNumber, yearFrom, yearTo, source, None, None), page=page, page_size=pageSize)


@router.get("/{projectId}/synthesis/quality/criteria")
async def quality_criteria(projectId: int, search: str | None = None, rqNumber: int | None = None, yearFrom: int | None = None, yearTo: int | None = None, source: str | None = None, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await _access(db, projectId, current_user)
    return await get_quality_criteria(db, access.project, _filters(search, rqNumber, yearFrom, yearTo, source, None, None))


@router.get("/{projectId}/synthesis/quality/studies")
async def quality_studies(projectId: int, criterionKey: str = "overall", search: str | None = None, rqNumber: int | None = None, yearFrom: int | None = None, yearTo: int | None = None, source: str | None = None, page: int = Query(1, ge=1), pageSize: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE), current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await _access(db, projectId, current_user)
    return await list_quality_studies(db, access.project, criterionKey, _filters(search, rqNumber, yearFrom, yearTo, source, None, None), page=page, page_size=pageSize)


@router.get("/{projectId}/synthesis/quality/studies/{articleId}")
async def quality_study(projectId: int, articleId: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await _access(db, projectId, current_user)
    study = await get_quality_study(db, access.project, articleId)
    if study is None:
        raise HTTPException(404, detail={"code": "SYNTHESIS_ARTICLE_NOT_FOUND"})
    return study


@router.post("/{projectId}/synthesis/rqs/{rqNumber}/generations", status_code=202)
async def generate(projectId: int, rqNumber: int, request: GenerationRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await _access(db, projectId, current_user, CAP_EDIT_PROJECT)
    try:
        job = await enqueue_generation(db, project=access.project, user=current_user, rq_number=rqNumber, request=request)
    except SynthesisConflict as exc:
        raise _conflict(exc)
    await db.commit()
    await db.refresh(job)
    return _job_payload(job)


@router.get("/{projectId}/synthesis/generations/{generationId}")
async def generation(projectId: int, generationId: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _access(db, projectId, current_user)
    job = await db.scalar(select(SynthesisGenerationJob).where(SynthesisGenerationJob.id == generationId, SynthesisGenerationJob.projectId == projectId))
    if job is None:
        raise HTTPException(404, detail={"code": "SYNTHESIS_GENERATION_NOT_FOUND"})
    return _job_payload(job)


@router.post("/{projectId}/synthesis/generations/{generationId}/cancel")
async def cancel(projectId: int, generationId: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await _access(db, projectId, current_user, CAP_EDIT_PROJECT)
    try:
        job = await cancel_generation(db, project=access.project, user=current_user, job_id=generationId)
    except LookupError:
        raise HTTPException(404, detail={"code": "SYNTHESIS_GENERATION_NOT_FOUND"})
    await db.commit()
    return _job_payload(job)


@router.patch("/{projectId}/synthesis/rqs/{rqNumber}")
async def save_draft(projectId: int, rqNumber: int, request: ManualSynthesisUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await _access(db, projectId, current_user, CAP_EDIT_PROJECT)
    try:
        saved = await save_manual_draft(db, project=access.project, user=current_user, rq_number=rqNumber, request=request)
    except SynthesisConflict as exc:
        raise _conflict(exc)
    await db.commit()
    draft = saved["draft"]
    return {"content": draft["content"], "version": draft["version"], "questionFingerprint": draft["questionFingerprint"], "evidenceFingerprint": draft["evidenceFingerprint"], "updatedAt": draft["updatedAt"], "updatedByUserId": draft["updatedByUserId"]}


@router.delete("/{projectId}/synthesis/rqs/{rqNumber}")
async def delete_draft(projectId: int, rqNumber: int, expectedVersion: int = Query(..., ge=1), confirm: bool = Query(False), current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await _access(db, projectId, current_user, CAP_EDIT_PROJECT)
    if not confirm:
        raise HTTPException(400, detail={"code": "SYNTHESIS_DELETE_CONFIRMATION_REQUIRED"})
    draft = await db.scalar(select(RQSynthesis).where(RQSynthesis.projectId == projectId, RQSynthesis.rqNumber == rqNumber))
    if draft is None:
        raise HTTPException(404, detail={"code": "SYNTHESIS_DRAFT_NOT_FOUND"})
    if draft.version != expectedVersion:
        raise HTTPException(409, detail={"code": "SYNTHESIS_VERSION_CONFLICT"})
    draft.rqNumber = None
    await db.commit()
    return Response(status_code=204)


@router.get("/{projectId}/synthesis/exports/{kind}")
async def export(projectId: int, kind: str, scope: str = "filtered", search: str | None = None, rqNumber: int | None = None, yearFrom: int | None = None, yearTo: int | None = None, source: str | None = None, qualityRating: str | None = None, completion: str | None = None, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await _access(db, projectId, current_user)
    if kind not in {"matrix.csv", "report.json", "distributions.csv", "quality.csv"} or scope not in {"filtered", "full"}:
        raise HTTPException(400, detail={"code": "INVALID_SYNTHESIS_EXPORT"})
    filters = _filters(search, rqNumber, yearFrom, yearTo, source, qualityRating, completion)
    if kind == "report.json":
        report_filters = filters if scope == "filtered" else {}
        return StreamingResponse(iter_json_report(db, access.project, report_filters, scope=scope), media_type="application/json; charset=utf-8", headers={"Content-Disposition": 'attachment; filename="synthesis-report.json"'})
    async def rows():
        if kind == "distributions.csv":
            catalog = await get_chart_catalog(db, access.project, filters)
            yield csv_row(["Campo", "Valor", "Estudos"])
            for chart_info in catalog:
                if chart_info.get("type") == "text":
                    continue
                chart_data = await get_chart(db, access.project, chart_info["key"], filters if scope == "filtered" else {}, page=1, page_size=MAX_PAGE_SIZE)
                for item in chart_data.get("rows", []):
                    yield csv_row([chart_info.get("label"), item.get("value"), item.get("count")])
            return
        if kind == "quality.csv":
            yield csv_row(["Estudo", "Ano", "Avaliação", "Pontuação", "Respostas"])
            page = 1
            while True:
                result = await list_quality_studies(db, access.project, "overall", filters if scope == "filtered" else {}, page=page, page_size=100)
                for item in result["items"]:
                    yield csv_row([item.get("title"), item.get("year"), item.get("qualityRating"), item.get("qualityScore"), json.dumps(item.get("qualityAnswers", {}), ensure_ascii=False)])
                if page * result["pageSize"] >= result["total"]:
                    break
                page += 1
            return
        headers = ["ID", "Título", "Ano", "Autores", "Fonte", "Decisão", "RQ", "Qualidade", "Extração"]
        yield csv_row(headers)
        async for item in iter_matrix_rows(db, access.project, filters, scope=scope):
            yield csv_row([item.get("articleId"), item.get("title"), item.get("year"), item.get("authors"), item.get("sourceName"), item.get("decision"), ", ".join(map(str, item.get("rqNumbers", []))), item.get("qualityRating"), json.dumps(item.get("extractionValues", {}), ensure_ascii=False)])
    return StreamingResponse(rows(), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": f'attachment; filename="{kind.replace(".", "-")}"'})
