#!/usr/bin/env python3
"""Read-only deployment smoke checks using Python's standard library."""
import json
import re
import sys
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import ProxyHandler, build_opener

base = sys.argv[1].rstrip("/")
client = build_opener(ProxyHandler({}))


def get(path):
    with client.open(base + path, timeout=20) as response:
        return response.read(), response.headers


health, _ = get("/health")
assert json.loads(health)["status"] == "ok", "API liveness failed"
ready, _ = get("/ready")
ready = json.loads(ready)
assert ready["status"] == "ready", ready
assert all(value == "ok" for value in ready["checks"].values()), ready
index, headers = get("/")
assert headers.get("Strict-Transport-Security") == "max-age=31536000", (
    "HTTPS enforcement is missing"
)
assert "text/html" in headers.get("Content-Type", ""), "Expected SPA HTML"
assert b"@vite/client" not in index, "Development frontend is running"
route, _ = get("/login")
assert route == index, "React deep links must serve index.html"
assets = [
    value.decode()
    for value in re.findall(rb'(?:src|href)="([^"\s]+\.(?:js|css))"', index)
    if not urlsplit(value.decode()).netloc
]
assert assets, "The frontend has no compiled assets"
for path in assets:
    data, asset_headers = get("/" + path.lstrip("/"))
    assert data and "text/html" not in asset_headers.get("Content-Type", ""), path
try:
    get("/api/auth/profile")
except HTTPError as error:
    assert error.code == 401, f"Expected anonymous access to be denied: {error.code}"
else:
    raise AssertionError("Anonymous profile access must be denied")
for path in ("/.env", "/production.env", "/backend/.env", "/.git/config"):
    try:
        get(path)
    except HTTPError as error:
        assert error.code == 404, f"Sensitive path must return 404: {path}"
    else:
        raise AssertionError(f"Sensitive path must return 404: {path}")
print(f"PASS: API health/readiness, SPA/deep link, {len(assets)} assets, anonymous auth ({base})")
