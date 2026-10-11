"""Pure projection of Article entities into the public response DTO."""

from app.schemas.article import ArticleResponse
from app.services.review_workflow_service import legacy_review_fields

_COMPUTED_FIELDS = {
    "reviewState",
    "reviewDecisions",
    "hasActiveReviewAssignments",
    "myReviewAssignment",
    "reviewAssignments",
    "canWriteReview",
    "canDecideReview",
    "canManageArticle",
    "hasPdf",
}


def build_article_response(article) -> ArticleResponse:
    """Build an ArticleResponse without writing compatibility values to the entity."""
    values = {
        name: getattr(article, name)
        for name in ArticleResponse.model_fields
        if name not in _COMPUTED_FIELDS and hasattr(article, name)
    }
    values.update(legacy_review_fields(article))
    values["hasPdf"] = article.pdfData is not None
    values["eligibilityChecklistAnswers"] = article.eligibilityChecklistAnswers or {}
    values["extractionData"] = article.extractionData or {}
    values["qualityAssessmentAnswers"] = article.qualityAssessmentAnswers or {}
    values["aiSuggestedRQs"] = article.aiSuggestedRQs or []
    values["aiKeywords"] = article.aiKeywords or []
    values["exclusionCriteria"] = values.get("exclusionCriteria") or []
    values["answeringRQs"] = article.answeringRQs or []
    values["qualityRating"] = article.qualityRating or "unrated"
    return ArticleResponse.model_validate(values)
