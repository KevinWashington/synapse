import ast
from pathlib import Path

import pytest

from db_test_support import new_test_database, validate_test_database_name


def _module_name(path: Path, app_root: Path) -> str:
    return "app." + ".".join(path.relative_to(app_root).with_suffix("").parts)


def _imported_modules(tree: ast.AST, current_module: str) -> set[str]:
    modules = set()
    package = current_module.rpartition(".")[0]
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            modules.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            if node.level:
                base = package.split(".")[: max(0, len(package.split(".")) - node.level + 1)]
                module = ".".join([*base, *(node.module.split(".") if node.module else [])])
            else:
                module = node.module or ""
            modules.add(module)
    return modules


@pytest.mark.unit
def test_backend_import_boundaries():
    backend_root = Path(__file__).resolve().parents[1]
    app_root = backend_root / "app"
    violations = []
    for layer in ("services", "routers"):
        for path in sorted((app_root / layer).glob("**/*.py")):
            current_module = _module_name(path, app_root)
            modules = _imported_modules(
                ast.parse(path.read_text(encoding="utf-8"), filename=str(path)), current_module
            )
            forbidden = (
                (
                    lambda module: module == "app.routers"
                    or module.startswith("app.routers.")
                    or module == "app.core.dependencies"
                )
                if layer == "services"
                else (lambda module: module == "app.routers" or module.startswith("app.routers."))
            )
            violations.extend(
                f"{path.relative_to(backend_root)} imports {module}"
                for module in sorted(modules)
                if forbidden(module)
            )
    assert not violations, "Architecture import boundary violations:\n" + "\n".join(violations)


@pytest.mark.unit
def test_test_database_names_are_unique_and_guarded():
    first = new_test_database("sample integration")
    second = new_test_database("sample integration")

    assert first.startswith("synapse_test_sample_integration_")
    assert first != second
    with pytest.raises(ValueError, match="Refusing to modify"):
        validate_test_database_name("synapse")
