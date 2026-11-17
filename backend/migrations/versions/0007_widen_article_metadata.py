"""Widen article bibliographic columns.

Real database exports (Scopus, WoS) routinely exceed the original limits for
authors, journal, keywords and title, which made a whole BibTeX import fail.
Widening VARCHAR columns is a metadata-only change in PostgreSQL.

Revision ID: 0007_widen_article_metadata
Revises: 0006_article_index_jobs
"""

import sqlalchemy as sa
from alembic import op

revision = "0007_widen_article_metadata"
down_revision = "0006_article_index_jobs"
branch_labels = None
depends_on = None

# column: (new type, previous type, previous length)
_CHANGES = {
    "title": (sa.String(1000), sa.String(200), 200),
    "authors": (sa.Text(), sa.String(300), 300),
    "journal": (sa.String(500), sa.String(200), 200),
    "doi": (sa.String(255), sa.String(100), 100),
    "keywords": (sa.Text(), sa.String(500), 500),
}


def upgrade():
    for column, (new_type, old_type, _length) in _CHANGES.items():
        op.alter_column("articles", column, type_=new_type, existing_type=old_type)


def downgrade():
    for column, (new_type, old_type, length) in _CHANGES.items():
        op.alter_column(
            "articles",
            column,
            type_=old_type,
            existing_type=new_type,
            postgresql_using=f'left("{column}", {length})',
        )
