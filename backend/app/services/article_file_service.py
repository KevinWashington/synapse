"""PDF storage policy independent of multipart/streaming HTTP transport."""

from app.core.errors import ApplicationError
from app.services.review_workflow_service import apply_legacy_review_state


class ArticleFileService:
    MAX_BYTES = 10 * 1024 * 1024

    def store_pdf(self, article, *, content: bytes, filename: str | None, content_type: str):
        if article.currentPhase != "eligibility":
            raise ApplicationError(
                "INVALID_REVIEW_PHASE", "O upload do PDF só é permitido na elegibilidade."
            )
        if content_type != "application/pdf":
            raise ApplicationError("INVALID_FILE_TYPE", "Apenas arquivos PDF são permitidos")
        if len(content) > self.MAX_BYTES:
            raise ApplicationError("FILE_TOO_LARGE", "O tamanho máximo permitido é 10MB")
        article.pdfData = content
        article.pdfFilename = filename
        article.pdfContentType = content_type
        article.fullTextStatus = "uploaded"
        if article.reviewOutcome == "full_text_unavailable":
            article.reviewOutcome = "active"
            article.eligibilityDecision = "pending"
            article.eligibilityReasonText = None
            article.eligibilityReviewedAt = None
        apply_legacy_review_state(article)
        return article

    def read_pdf(self, article) -> tuple[bytes, str, str]:
        if not article.pdfData:
            raise ApplicationError("PDF_NOT_FOUND", "Este artigo não possui PDF", status_code=404)
        return (
            article.pdfData,
            article.pdfContentType or "application/pdf",
            article.pdfFilename or "artigo.pdf",
        )
