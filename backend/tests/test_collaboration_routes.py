def test_collaboration_routes_are_registered():
    from app.main import app

    routes = {(route.path, method) for route in app.routes for method in getattr(route, "methods", set())}
    expected = {
        ("/api/projetos/{projectId}/members", "GET"),
        ("/api/projetos/{projectId}/invitations", "POST"),
        ("/api/projetos/{projectId}/transfer-ownership", "POST"),
        ("/api/projetos/{projectId}/notifications", "GET"),
        ("/api/projetos/{projectId}/notifications/read-all", "POST"),
    }
    assert expected <= routes


def test_team_member_response_represents_implicit_owner_with_identity():
    from datetime import datetime, timezone
    from types import SimpleNamespace

    from app.routers.collaboration import build_member_response

    now = datetime.now(timezone.utc)
    owner = SimpleNamespace(id=1, name="Owner", email="owner@example.com", avatar=None)
    response = build_member_response(
        project_id=7,
        user=owner,
        role="owner",
        participates_in_review=True,
        membership=None,
        joined_at=now,
    )

    assert response.id is None
    assert response.userId == 1
    assert response.role == "owner"
    assert response.name == "Owner"
    assert response.email == "owner@example.com"
