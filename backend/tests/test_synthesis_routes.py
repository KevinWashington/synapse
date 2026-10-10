def test_synthesis_workspace_routes_are_registered():
    from app.main import app

    routes = {(route.path, method) for route in app.routes for method in getattr(route, "methods", set())}
    expected = {
        ("/api/projetos/{projectId}/synthesis/overview", "GET"),
        ("/api/projetos/{projectId}/synthesis/rqs", "GET"),
        ("/api/projetos/{projectId}/synthesis/rqs/{rqNumber}", "GET"),
        ("/api/projetos/{projectId}/synthesis/rqs/{rqNumber}/evidence", "GET"),
        ("/api/projetos/{projectId}/synthesis/matrix", "GET"),
        ("/api/projetos/{projectId}/synthesis/matrix/{articleId}", "GET"),
        ("/api/projetos/{projectId}/synthesis/charts", "GET"),
        ("/api/projetos/{projectId}/synthesis/quality/criteria", "GET"),
        ("/api/projetos/{projectId}/synthesis/quality/studies", "GET"),
        ("/api/projetos/{projectId}/synthesis/rqs/{rqNumber}/generations", "POST"),
        ("/api/projetos/{projectId}/synthesis/rqs/{rqNumber}", "PATCH"),
        ("/api/projetos/{projectId}/synthesis/rqs/{rqNumber}", "DELETE"),
        ("/api/projetos/{projectId}/synthesis/generations/{generationId}", "GET"),
        ("/api/projetos/{projectId}/synthesis/generations/{generationId}/cancel", "POST"),
        ("/api/projetos/{projectId}/synthesis/exports/{kind}", "GET"),
    }
    assert expected <= routes


def test_export_cells_are_formula_safe_and_unicode_preserving():
    from app.services.synthesis_export_service import csv_safe_cell

    assert csv_safe_cell("=SUM(1,2)") == "'=SUM(1,2)"
    assert csv_safe_cell("  +cmd") == "'  +cmd"
    assert csv_safe_cell("Revisão, ‘ação’\nlinha 2") == "Revisão, ‘ação’\nlinha 2"
