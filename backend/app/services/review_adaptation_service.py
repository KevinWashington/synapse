"""Explicit, previewed changes to unfinished review assignments after team changes."""

from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json

from fastapi import HTTPException
from sqlalchemy import func, select

from app.models.article import Article
from app.models.collaboration import ReviewAssignment, ReviewConflict, ReviewDecision
from app.services.invitation_service import create_audit_event
from app.services.notification_service import create_notification
from app.services.project_access_service import CAP_MANAGE_DISTRIBUTION, require_capability
from app.services.review_assignment_service import AssignmentPlanItem, _DISTRIBUTION_LOCK_KEYS, _eligible_reviewer_ids
from app.services.review_decision_service import apply_canonical_decision, _inherit_eligibility_assignments
from app.services.team_lock_service import lock_project_team


@dataclass(frozen=True)
class AdaptationPlan:
    cancel_ids: tuple[int, ...]
    additions: tuple[AssignmentPlanItem, ...]
    consolidate_ids: tuple[int, ...]
    loads: dict[int, int]


def build_adaptation_plan(article_ids, reviewer_ids, assignments):
    reviewers = sorted(set(reviewer_ids))
    if not reviewers:
        raise ValueError("É necessário ao menos um revisor elegível.")
    target = min(2, len(reviewers))
    groups = {id: [] for id in sorted(article_ids)}
    for row in assignments:
        if row.articleId in groups and row.status != "cancelled":
            groups[row.articleId].append(row)
    kept_by_article = {}
    cancelled, additions, consolidate = [], [], []
    loads = Counter({id: 0 for id in reviewers})
    for article_id, rows in groups.items():
        submitted = sorted((r for r in rows if r.status == "submitted"), key=lambda r: r.slot)
        # Completed pairs and their disagreements are never reopened by adaptation.
        if len(submitted) >= 2:
            kept_by_article[article_id] = submitted
            continue
        kept = list(submitted)
        for row in sorted((r for r in rows if r.status != "submitted"), key=lambda r: r.slot):
            if row.status == "pending" and row.reviewerUserId in reviewers and len(kept) < target:
                kept.append(row)
                loads[row.reviewerUserId] += 1
            else:
                cancelled.append(row.id)
        kept_by_article[article_id] = kept
    for article_id, kept in kept_by_article.items():
        users = {row.reviewerUserId for row in kept}
        slots = {row.slot for row in kept}
        missing = max(0, target - len(kept))
        for _ in range(missing):
            user = min((id for id in reviewers if id not in users), key=lambda id: (loads[id], id))
            slot = next(slot for slot in (1, 2) if slot not in slots)
            additions.append(AssignmentPlanItem(article_id, user, slot))
            users.add(user)
            slots.add(slot)
            loads[user] += 1
        if len(kept) == 1 and kept[0].status == "submitted" and not missing:
            consolidate.append(article_id)
    return AdaptationPlan(tuple(cancelled), tuple(additions), tuple(consolidate), dict(loads))


async def _snapshot(db, *, access, phase, lock=False):
    # Article locks match decision submission's lock order (article, then assignments).
    query = select(Article).where(
        Article.projectId == access.project.id,
        Article.currentPhase == phase,
        Article.reviewOutcome == "active",
        ~Article.id.in_(select(ReviewConflict.articleId).where(
            ReviewConflict.projectId == access.project.id,
            ReviewConflict.phase == phase,
            ReviewConflict.status == "open",
        )),
    ).order_by(Article.id)
    if lock:
        query = query.with_for_update()
    articles = list((await db.execute(query)).scalars().all())
    ids = [a.id for a in articles]
    query = select(ReviewAssignment).where(
        ReviewAssignment.projectId == access.project.id,
        ReviewAssignment.phase == phase,
        ReviewAssignment.articleId.in_(ids),
    ).order_by(ReviewAssignment.id)
    if lock:
        query = query.with_for_update()
    assignments = list((await db.execute(query)).scalars().all())
    decisions = list((await db.execute(select(ReviewDecision).where(
        ReviewDecision.projectId == access.project.id,
        ReviewDecision.phase == phase,
        ReviewDecision.articleId.in_(ids),
        ReviewDecision.status == "submitted",
    ).order_by(ReviewDecision.id))).scalars().all())
    reviewers = await _eligible_reviewer_ids(db, access)
    plan = build_adaptation_plan(ids, reviewers, assignments)
    payload = [phase, reviewers, ids,
               [(r.id, r.articleId, r.reviewerUserId, r.slot, r.status) for r in assignments],
               [(d.id, d.assignmentId, d.decision, d.reasonText, d.checklistAnswers, d.answeringRQs) for d in decisions]]
    fingerprint = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    affected = {r.articleId for r in assignments if r.id in plan.cancel_ids}
    affected.update(a.article_id for a in plan.additions)
    affected.update(plan.consolidate_ids)
    response = {
        "phase": phase, "reviewerCount": len(reviewers), "reviewsPerArticle": min(2, len(reviewers)),
        "articleCount": len(affected), "cancelledCount": len(plan.cancel_ids),
        "assignedCount": len(plan.additions), "consolidatedCount": len(plan.consolidate_ids),
        "loads": plan.loads, "fingerprint": fingerprint,
    }
    return response, plan, articles, assignments, decisions


async def preview_adaptation(db, *, access, phase):
    require_capability(access, CAP_MANAGE_DISTRIBUTION)
    response, *_ = await _snapshot(db, access=access, phase=phase)
    return response


async def adapt_reviews(db, *, access, phase, fingerprint, actor_user_id):
    require_capability(access, CAP_MANAGE_DISTRIBUTION)
    await lock_project_team(db, access.project.id)
    await db.execute(select(func.pg_advisory_xact_lock(access.project.id, _DISTRIBUTION_LOCK_KEYS[phase])))
    response, plan, articles, assignments, decisions = await _snapshot(db, access=access, phase=phase, lock=True)
    if fingerprint != response["fingerprint"]:
        raise HTTPException(status_code=409, detail={"code": "ADAPTATION_PREVIEW_STALE", "message": "A equipe ou as revisões mudaram. Gere uma nova prévia antes de adaptar."})
    now = datetime.now(timezone.utc)
    for row in assignments:
        if row.id in plan.cancel_ids:
            row.status = "cancelled"
            row.cancelledAt = now
    # Release unique active slots before reusing them.
    await db.flush()
    counts = Counter()
    for item in plan.additions:
        existing = next((r for r in assignments if r.articleId == item.article_id and r.reviewerUserId == item.reviewer_user_id), None)
        if existing is None:
            existing = ReviewAssignment(projectId=access.project.id, articleId=item.article_id, phase=phase, reviewerUserId=item.reviewer_user_id)
            db.add(existing)
            assignments.append(existing)
        existing.slot = item.slot
        existing.status = "pending"
        existing.cancelledAt = None
        existing.submittedAt = None
        existing.assignedByUserId = actor_user_id
        existing.assignedAt = now
        counts[item.reviewer_user_id] += 1
    await db.flush()
    consolidated = []
    for article in articles:
        if article.id not in plan.consolidate_ids:
            continue
        active = [r for r in assignments if r.articleId == article.id and r.status != "cancelled"]
        decision = next((d for d in decisions if d.articleId == article.id and d.assignmentId == active[0].id), None)
        if decision is None:
            raise HTTPException(status_code=409, detail={"code": "REVIEW_DECISION_MISSING", "message": "Uma decisão registrada não foi encontrada. Atualize a revisão antes de adaptar."})
        apply_canonical_decision(article, phase=phase, decision=decision)
        if phase == "screening" and decision.decision == "included":
            await _inherit_eligibility_assignments(db, article=article, assignments=active, actor_user_id=actor_user_id, owner_user_id=access.project.ownerId)
        consolidated.append(article)
    if response["articleCount"]:
        create_audit_event(db, project_id=access.project.id, actor_user_id=actor_user_id,
                           action="review_distribution_adapted", entity_type="assignment_batch",
                           payload={key: value for key, value in response.items() if key != "fingerprint"})
    for reviewer, count in counts.items():
        create_notification(db, project_id=access.project.id, recipient_user_id=reviewer,
                            type="reviews_assigned", title="Distribuição adaptada à equipe",
                            body=f"{count} revisão(ões) foram atribuídas a você.", entity_type="assignment_batch",
                            payload={"phase": phase, "count": count})
    await db.flush()
    return response, consolidated
