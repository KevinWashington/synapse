"""Add Google identity and encrypted DeepSeek credential fields.

Revision ID: 0002_google_identity_credentials
Revises: 0001_existing_schema
Create Date: 2026-10-05
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0002_google_identity_credentials"
down_revision: Union[str, None] = "0001_existing_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("users", "passwordHash", existing_type=sa.String(length=255), nullable=True)
    op.add_column("users", sa.Column("googleSub", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("deepseekKeyCiphertext", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("deepseekKeyVersion", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("deepseekKeyLastFour", sa.String(length=4), nullable=True))
    op.add_column("users", sa.Column("deepseekKeyUpdatedAt", sa.DateTime(timezone=True), nullable=True))
    op.create_index(
        "uq_users_google_sub_not_null",
        "users",
        ["googleSub"],
        unique=True,
        postgresql_where=sa.text('"googleSub" IS NOT NULL'),
    )


def downgrade() -> None:
    op.drop_index("uq_users_google_sub_not_null", table_name="users")
    op.drop_column("users", "deepseekKeyUpdatedAt")
    op.drop_column("users", "deepseekKeyLastFour")
    op.drop_column("users", "deepseekKeyVersion")
    op.drop_column("users", "deepseekKeyCiphertext")
    op.drop_column("users", "googleSub")
    op.alter_column("users", "passwordHash", existing_type=sa.String(length=255), nullable=False)
