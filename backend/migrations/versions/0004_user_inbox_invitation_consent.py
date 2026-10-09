"""Require explicit invitation consent.

Revision ID: 0004_inbox_invite_consent
Revises: 0003_project_collaboration
Create Date: 2026-10-09
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0004_inbox_invite_consent"
down_revision: Union[str, None] = "0003_project_collaboration"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_project_invitations_status", "project_invitations", type_="check")
    op.create_check_constraint(
        "ck_project_invitations_status",
        "project_invitations",
        "status IN ('pending', 'accepted', 'declined', 'cancelled', 'expired')",
    )
    op.add_column(
        "project_invitations",
        sa.Column("declinedAt", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("project_invitations", "declinedAt")
    op.drop_constraint("ck_project_invitations_status", "project_invitations", type_="check")
    op.create_check_constraint(
        "ck_project_invitations_status",
        "project_invitations",
        "status IN ('pending', 'accepted', 'cancelled', 'expired')",
    )
