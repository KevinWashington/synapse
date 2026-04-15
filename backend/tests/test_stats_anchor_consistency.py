import importlib
import sys


def _load_stats_module(monkeypatch):
    monkeypatch.setenv("DEBUG", "false")
    sys.modules.pop("app.routers.stats", None)

    import app.config as config_module

    importlib.reload(config_module)
    module = importlib.import_module("app.routers.stats")
    return importlib.reload(module)


def test_anchor_joinability_detects_count_mismatch(monkeypatch):
    stats_module = _load_stats_module(monkeypatch)

    result = stats_module._build_anchor_joinability(
        postgres_metrics={"ok": True, "total": 49, "with_anchor": 49, "missing_anchor": 0},
        vector_metrics={"vector_anchor_count": 2, "vector_missing_anchor_count": 0},
    )

    assert result["joinable"] is False
    assert result["missingAnchorIndicators"] == {"postgres": 0, "vector": 0}
    assert result["countParity"] == {
        "postgresAnchoredArticles": 49,
        "vectorAnchoredPoints": 2,
        "countMismatch": True,
    }
