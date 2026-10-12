#!/usr/bin/env python3
"""Catch frontend imports that work on Windows but fail on Linux."""
import posixpath
import re
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parent.parent
tracked = set(subprocess.check_output(["git", "ls-files", "frontend/src"], cwd=root, text=True).splitlines())
aliases = {
    "@/": "frontend/src/",
    "@components/": "frontend/src/components/",
    "@features/": "frontend/src/features/",
    "@hooks/": "frontend/src/hooks/",
    "@services/": "frontend/src/services/",
}
pattern = re.compile(r'''(?:from\s*|import\s*\(\s*|import\s*)["']([^"']+)["']''')
failures = []
for filename in sorted(tracked):
    if not filename.endswith((".js", ".jsx", ".ts", ".tsx")):
        continue
    for specifier in pattern.findall((root / filename).read_text(encoding="utf-8")):
        specifier = specifier.split("?", 1)[0]
        if specifier.startswith("."):
            target = posixpath.normpath(posixpath.join(posixpath.dirname(filename), specifier))
        else:
            prefix = next((prefix for prefix in aliases if specifier.startswith(prefix)), None)
            if prefix is None:
                continue
            target = aliases[prefix] + specifier[len(prefix):]
        candidates = [target]
        for extension in (".js", ".jsx", ".ts", ".tsx", ".json", ".css", ".scss", ".svg"):
            candidates.extend((target + extension, target + "/index" + extension))
        if not any(candidate in tracked for candidate in candidates):
            failures.append(f"{filename}: {specifier}")
assert not failures, "Imports missing or with incorrect filename case:\n" + "\n".join(failures)
print("PASS: frontend import paths match Git filenames, including case")
