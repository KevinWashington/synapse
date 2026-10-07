from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.services.project_access_service import (
    CAP_DELETE_PROJECT,
    CAP_EDIT_PROJECT,
    CAP_MANAGE_DISTRIBUTION,
    CAP_MANAGE_MEMBERS,
    CAP_READ_PROJECT,
    CAP_REVIEW_ASSIGNED,
    CAP_TRANSFER_OWNERSHIP,
    accessible_project_ids_query,
    get_project_article,
    require_capability,
    resolve_project_access,
)


class ScalarResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


@pytest.mark.asyncio
async def test_owner_receives_full_project_capabilities():
    db = SimpleNamespace(execute=AsyncMock(return_value=ScalarResult(SimpleNamespace(id=7, ownerId=11))))

    access = await resolve_project_access(db, project_id=7, user_id=11)

    assert access.role == "owner"
    assert {CAP_READ_PROJECT, CAP_EDIT_PROJECT, CAP_MANAGE_MEMBERS, CAP_MANAGE_DISTRIBUTION, CAP_DELETE_PROJECT, CAP_TRANSFER_OWNERSHIP} <= access.capabilities
    assert access.participates_in_review is True


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("role", "participates", "expected", "unexpected"),
    [
        ("coordinator", False, CAP_MANAGE_MEMBERS, CAP_REVIEW_ASSIGNED),
        ("reviewer", True, CAP_REVIEW_ASSIGNED, CAP_EDIT_PROJECT),
    ],
)
async def test_active_member_receives_role_capabilities(role, participates, expected, unexpected):
    db = SimpleNamespace(
        execute=AsyncMock(
            side_effect=[
                ScalarResult(SimpleNamespace(id=7, ownerId=11)),
                ScalarResult(SimpleNamespace(role=role, status="active", participatesInReview=participates)),
            ]
        )
    )

    access = await resolve_project_access(db, project_id=7, user_id=22)

    assert expected in access.capabilities
    assert unexpected not in access.capabilities
    assert access.participates_in_review is participates


@pytest.mark.asyncio
@pytest.mark.parametrize("member", [None, SimpleNamespace(role="reviewer", status="inactive", participatesInReview=True)])
async def test_missing_or_inactive_member_receives_same_not_found(member):
    db = SimpleNamespace(
        execute=AsyncMock(
            side_effect=[ScalarResult(SimpleNamespace(id=7, ownerId=11)), ScalarResult(member)]
        )
    )

    with pytest.raises(HTTPException) as exc:
        await resolve_project_access(db, project_id=7, user_id=22)

    assert exc.value.status_code == 404
    assert exc.value.detail["code"] == "PROJECT_NOT_FOUND"


def test_require_capability_denies_without_leaking_project_existence():
    access = SimpleNamespace(capabilities=frozenset({CAP_READ_PROJECT}))

    with pytest.raises(HTTPException) as exc:
        require_capability(access, CAP_EDIT_PROJECT)

    assert exc.value.status_code == 403
    assert exc.value.detail["code"] == "PROJECT_PERMISSION_DENIED"


def test_accessible_project_query_unions_owned_and_active_shared_projects():
    sql = str(accessible_project_ids_query(22))

    assert 'projects."ownerId"' in sql
    assert "project_members" in sql
    assert 'project_members.status' in sql
    assert " OR " in sql


@pytest.mark.asyncio
async def test_article_lookup_is_scoped_by_project_not_owner():
    article = SimpleNamespace(id=5, projectId=7, ownerId=999)
    db = SimpleNamespace(execute=AsyncMock(return_value=ScalarResult(article)))

    result = await get_project_article(db, project_id=7, article_id=5)

    assert result is article
    sql = str(db.execute.await_args.args[0])
    assert 'articles."projectId"' in sql
    assert 'articles."ownerId"' not in sql.split("WHERE", 1)[1]
