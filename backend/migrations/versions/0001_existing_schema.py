"""Create the existing Synapse relational schema.

Revision ID: 0001_existing_schema
Revises:
Create Date: 2026-10-05
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0001_existing_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("passwordHash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("isActive", sa.Boolean(), nullable=False),
        sa.Column("avatar", sa.String(length=500), nullable=True),
        sa.Column("lastLogin", sa.DateTime(timezone=True), nullable=True),
        sa.Column("createdAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("title", sa.String(length=100), nullable=False),
        sa.Column("objetivo", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("framework", sa.String(length=10), nullable=False),
        sa.Column("picoc", sa.JSON(), nullable=True),
        sa.Column("researchQuestions", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("keywords", postgresql.ARRAY(sa.String(length=100)), nullable=True),
        sa.Column("searchStrings", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("criteriosInclusao", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("criteriosExclusao", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("eligibilityChecklist", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("dataExtractionSchema", sa.JSON(), nullable=True),
        sa.Column("qualityAssessmentSchema", sa.JSON(), nullable=True),
        sa.Column("screeningGuidance", sa.Text(), nullable=True),
        sa.Column("selectionReportNotes", sa.Text(), nullable=True),
        sa.Column("ownerId", sa.Integer(), nullable=False),
        sa.Column("createdAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["ownerId"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "articles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("authors", sa.String(length=300), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("journal", sa.String(length=200), nullable=False),
        sa.Column("paperId", sa.String(length=120), nullable=True),
        sa.Column("doi", sa.String(length=100), nullable=True),
        sa.Column("abstract", sa.Text(), nullable=True),
        sa.Column("keywords", sa.String(length=500), nullable=True),
        sa.Column("pages", sa.String(length=50), nullable=True),
        sa.Column("volume", sa.String(length=50), nullable=True),
        sa.Column("number", sa.String(length=50), nullable=True),
        sa.Column("issn", sa.String(length=50), nullable=True),
        sa.Column("notas", sa.Text(), nullable=True),
        sa.Column("entryMethod", sa.String(length=20), nullable=False),
        sa.Column("sourceCategory", sa.String(length=30), nullable=False),
        sa.Column("sourceName", sa.String(length=120), nullable=False),
        sa.Column("importBatchLabel", sa.String(length=120), nullable=True),
        sa.Column("studyType", sa.String(length=50), nullable=True),
        sa.Column("currentPhase", sa.String(length=30), nullable=False),
        sa.Column("reviewOutcome", sa.String(length=40), nullable=False),
        sa.Column("duplicateGroupKey", sa.String(length=120), nullable=True),
        sa.Column("duplicateOfArticleId", sa.Integer(), nullable=True),
        sa.Column("duplicateReasonCode", sa.String(length=40), nullable=True),
        sa.Column("duplicateReasonText", sa.Text(), nullable=True),
        sa.Column("screeningDecision", sa.String(length=20), nullable=False),
        sa.Column("screeningReasonText", sa.Text(), nullable=True),
        sa.Column("screeningReviewedAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("fullTextStatus", sa.String(length=30), nullable=False),
        sa.Column("eligibilityDecision", sa.String(length=20), nullable=False),
        sa.Column("eligibilityReasonText", sa.Text(), nullable=True),
        sa.Column("eligibilityReviewedAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("eligibilityChecklistAnswers", sa.JSON(), nullable=True),
        sa.Column("extractionData", sa.JSON(), nullable=True),
        sa.Column("extractionCompletedAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("qualityAssessmentAnswers", sa.JSON(), nullable=True),
        sa.Column("qualityScore", sa.Float(), nullable=True),
        sa.Column("qualityRating", sa.String(length=20), nullable=True),
        sa.Column("includedAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("pdfFilename", sa.String(length=255), nullable=True),
        sa.Column("pdfData", sa.LargeBinary(), nullable=True),
        sa.Column("pdfContentType", sa.String(length=50), nullable=False),
        sa.Column("aiEvaluation", sa.Text(), nullable=True),
        sa.Column("aiSuggestedStatus", sa.String(length=20), nullable=True),
        sa.Column("aiRelevanceScore", sa.Integer(), nullable=True),
        sa.Column("aiSuggestedRQs", postgresql.ARRAY(sa.Integer()), nullable=True),
        sa.Column("manualDecision", sa.String(length=20), nullable=True),
        sa.Column("manualDecisionReason", sa.Text(), nullable=True),
        sa.Column("exclusionCriteria", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("answeringRQs", postgresql.ARRAY(sa.Integer()), nullable=True),
        sa.Column("decisionUpdatedAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("aiMethodology", sa.String(length=255), nullable=True),
        sa.Column("aiDatabase", sa.String(length=255), nullable=True),
        sa.Column("aiDomain", sa.String(length=255), nullable=True),
        sa.Column("aiKeywords", postgresql.ARRAY(sa.String(length=50)), nullable=True),
        sa.Column("projectId", sa.Integer(), nullable=False),
        sa.Column("ownerId", sa.Integer(), nullable=False),
        sa.Column("createdAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["duplicateOfArticleId"], ["articles.id"]),
        sa.ForeignKeyConstraint(["ownerId"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["projectId"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_articles_project_paperid", "articles", ["projectId", "paperId"], unique=False)
    op.create_index(op.f("ix_articles_duplicateGroupKey"), "articles", ["duplicateGroupKey"], unique=False)
    op.create_index(op.f("ix_articles_ownerId"), "articles", ["ownerId"], unique=False)
    op.create_index(op.f("ix_articles_paperId"), "articles", ["paperId"], unique=False)
    op.create_index(op.f("ix_articles_projectId"), "articles", ["projectId"], unique=False)

    op.create_table(
        "articleRelationships",
        sa.Column("articleId", sa.Integer(), nullable=False),
        sa.Column("relatedArticleId", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["articleId"], ["articles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["relatedArticleId"], ["articles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("articleId", "relatedArticleId"),
    )


def downgrade() -> None:
    op.drop_table("articleRelationships")
    op.drop_index(op.f("ix_articles_projectId"), table_name="articles")
    op.drop_index(op.f("ix_articles_paperId"), table_name="articles")
    op.drop_index(op.f("ix_articles_ownerId"), table_name="articles")
    op.drop_index(op.f("ix_articles_duplicateGroupKey"), table_name="articles")
    op.drop_index("idx_articles_project_paperid", table_name="articles")
    op.drop_table("articles")
    op.drop_table("projects")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
