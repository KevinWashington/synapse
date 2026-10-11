"""Article dedup responsibilities independent of HTTP routing."""

from __future__ import annotations

import re
from difflib import SequenceMatcher

from app.models.article import Article
from app.schemas.article import DuplicateCandidate, DuplicateCandidateArticle
from app.services.review_workflow_service import apply_legacy_review_state

_INVALID_ANCHOR_CHARS = re.compile(r"[^a-z0-9]+")


def normalize_text(value: str | None) -> str:
    if not value:
        return ""
    normalized = re.sub(r"\s+", " ", value).strip().lower()
    normalized = _INVALID_ANCHOR_CHARS.sub(" ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def normalize_doi(value: str | None) -> str | None:
    if not value:
        return None
    normalized = normalize_text(value).replace(" ", "")
    return normalized or None


def normalized_title_year_key(title: str | None, year: int | None) -> str | None:
    normalized_title = normalize_text(title)
    if not normalized_title or year is None:
        return None
    return f"{normalized_title}|{year}"


def shared_author_signature(authors: str | None) -> set[str]:
    normalized = (authors or "").replace(" and ", ";")
    return {part.strip().lower() for part in normalized.split(";") if part.strip()}


def analyze_duplicates(articles: list[Article]) -> list[DuplicateCandidate]:
    groups: dict[str, DuplicateCandidate] = {}
    candidate_pool = [article for article in articles if article.reviewOutcome == "active"]

    used_ids: set[int] = set()
    doi_groups: dict[str, list[Article]] = {}
    for article in candidate_pool:
        normalized_doi = normalize_doi(article.doi)
        if normalized_doi:
            doi_groups.setdefault(normalized_doi, []).append(article)

    for normalized_doi, matches in doi_groups.items():
        if len(matches) < 2:
            continue
        group_key = f"doi:{normalized_doi}"
        groups[group_key] = DuplicateCandidate(
            groupKey=group_key,
            reasonCode="same_doi",
            reasonText="DOI idêntico detectado automaticamente.",
            candidateIds=[article.id for article in matches],
            articles=[
                DuplicateCandidateArticle(
                    id=article.id,
                    title=article.title,
                    authors=article.authors,
                    year=article.year,
                    journal=article.journal,
                    doi=article.doi,
                    sourceName=article.sourceName,
                    sourceCategory=article.sourceCategory,
                    reviewOutcome=article.reviewOutcome,
                )
                for article in matches
            ],
        )
        used_ids.update(article.id for article in matches)

    title_year_groups: dict[str, list[Article]] = {}
    for article in candidate_pool:
        if article.id in used_ids:
            continue
        key = normalized_title_year_key(article.title, article.year)
        if key:
            title_year_groups.setdefault(key, []).append(article)

    for title_year_key, matches in title_year_groups.items():
        if len(matches) < 2:
            continue
        group_key = f"title-year:{title_year_key}"
        groups[group_key] = DuplicateCandidate(
            groupKey=group_key,
            reasonCode="same_title_year",
            reasonText="Título normalizado e ano coincidem.",
            candidateIds=[article.id for article in matches],
            articles=[
                DuplicateCandidateArticle(
                    id=article.id,
                    title=article.title,
                    authors=article.authors,
                    year=article.year,
                    journal=article.journal,
                    doi=article.doi,
                    sourceName=article.sourceName,
                    sourceCategory=article.sourceCategory,
                    reviewOutcome=article.reviewOutcome,
                )
                for article in matches
            ],
        )
        used_ids.update(article.id for article in matches)

    remaining = [article for article in candidate_pool if article.id not in used_ids]
    strong_group_index = 0
    strong_groups: list[list[Article]] = []
    visited: set[int] = set()
    for article in remaining:
        if article.id in visited:
            continue
        cluster = [article]
        visited.add(article.id)
        article_title = normalize_text(article.title)
        article_authors = shared_author_signature(article.authors)
        article_doi = normalize_doi(article.doi)
        for other in remaining:
            if other.id in visited or other.id == article.id:
                continue
            if article.year != other.year:
                continue
            other_doi = normalize_doi(other.doi)
            if article_doi and other_doi and article_doi != other_doi:
                continue
            other_title = normalize_text(other.title)
            if not article_title or not other_title:
                continue
            similarity = SequenceMatcher(None, article_title, other_title).ratio()
            other_authors = shared_author_signature(other.authors)
            if similarity >= 0.96 and (
                article_authors & other_authors
                or normalize_text(article.journal) == normalize_text(other.journal)
            ):
                cluster.append(other)
                visited.add(other.id)
        if len(cluster) > 1:
            strong_groups.append(cluster)

    for matches in strong_groups:
        strong_group_index += 1
        group_key = f"strong:{strong_group_index}"
        groups[group_key] = DuplicateCandidate(
            groupKey=group_key,
            reasonCode="strong_metadata_match",
            reasonText="Alta similaridade entre título, ano e metadados.",
            candidateIds=[article.id for article in matches],
            articles=[
                DuplicateCandidateArticle(
                    id=article.id,
                    title=article.title,
                    authors=article.authors,
                    year=article.year,
                    journal=article.journal,
                    doi=article.doi,
                    sourceName=article.sourceName,
                    sourceCategory=article.sourceCategory,
                    reviewOutcome=article.reviewOutcome,
                )
                for article in matches
            ],
        )

    return sorted(groups.values(), key=lambda item: item.groupKey)


def assign_duplicate_markers(articles: list[Article], candidates: list[DuplicateCandidate]) -> None:
    for article in articles:
        if article.reviewOutcome == "active":
            article.duplicateGroupKey = None
            article.duplicateReasonCode = None
            article.duplicateReasonText = None

    article_map = {article.id: article for article in articles}
    for candidate in candidates:
        for article_id in candidate.candidateIds:
            article = article_map.get(article_id)
            if article is None or article.reviewOutcome != "active":
                continue
            article.duplicateGroupKey = candidate.groupKey
            article.duplicateReasonCode = candidate.reasonCode
            article.duplicateReasonText = candidate.reasonText


def promote_unique_identification_articles(articles: list[Article]) -> dict[str, int]:
    identification_articles = [
        article
        for article in articles
        if article.reviewOutcome == "active" and article.currentPhase == "identification"
    ]
    candidates = analyze_duplicates(identification_articles)
    assign_duplicate_markers(identification_articles, candidates)

    unresolved_ids = {
        article_id for candidate in candidates for article_id in candidate.candidateIds
    }
    moved_count = 0
    for article in identification_articles:
        if article.id in unresolved_ids:
            continue
        article.currentPhase = "screening"
        article.screeningDecision = "pending"
        apply_legacy_review_state(article)
        moved_count += 1

    return {
        "movedCount": moved_count,
        "unresolvedDuplicateGroups": len(candidates),
        "unresolvedDuplicateRecords": len(unresolved_ids),
    }
