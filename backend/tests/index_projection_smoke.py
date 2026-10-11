"""Manual real-index regression against the isolated E2E stack only."""

import json
import subprocess
import time
from pathlib import Path

import httpx


def main():
    stack = json.loads(subprocess.check_output(["docker", "inspect", "synapse-refactor-test-api"]))[0]
    environment = stack["Config"]["Env"]
    if "APP_ENV=test" not in environment or not any(
        item.startswith("DATABASE_URL=") and item.endswith("/synapse_refactor_test")
        for item in environment
    ):
        raise RuntimeError("Smoke requires the named disposable test API")
    if not any(binding["HostPort"] == "5000" for binding in stack["NetworkSettings"]["Ports"]["5000/tcp"]):
        raise RuntimeError("Test API must own port 5000")
    sessions = json.loads(Path(".e2e-sessions.json").read_text())
    client = httpx.Client(base_url="http://localhost:5000", timeout=30, trust_env=False,
        cookies={"synapse_session": sessions["E2E_SESSION_TOKEN"], "synapse_session_csrf": "index-smoke"},
        headers={"X-CSRF-Token": "index-smoke"})
    vector = httpx.Client(base_url="http://localhost:6333", timeout=5, trust_env=False)
    worker = "synapse-refactor-test-index-worker"
    project_id = None

    def request(method, path, **kwargs):
        response = client.request(method, path, **kwargs)
        response.raise_for_status()
        return response.json() if response.content else None

    def point(article_id):
        response = vector.get(f"/collections/articles/points/{article_id}")
        if response.status_code == 404:
            return None
        response.raise_for_status()
        return response.json()["result"]

    def node(article_id):
        graph = request("GET", f"/api/projetos/{project_id}/grafo")
        return any(item["id"] == f"article:{article_id}" for item in graph["nodes"])

    def wait_until(check, label):
        deadline = time.monotonic() + 45
        while time.monotonic() < deadline:
            if check():
                print(f"PASS {label}", flush=True)
                return
            time.sleep(0.2)
        raise AssertionError(f"Timed out: {label}")

    try:
        project = request("POST", "/api/projetos", json={"title": "Disposable index smoke", "objetivo": "Validate durable projections"})
        project_id = project["id"]
        base = f"/api/projetos/{project_id}/artigos"
        article = request("POST", base, json={"title": "Smoke study", "authors": "Test Author", "year": 2025,
            "journal": "Test Journal", "sourceCategory": "database", "sourceName": "Smoke fixture",
            "abstract": "A deterministic local embedding validates index recovery."})
        article_id = article["id"]
        article_path = f"{base}/{article_id}"
        request("POST", f"{article_path}/screening-decision", json={"decision": "included"})
        request("POST", f"{article_path}/pdf", files={"file": ("study.pdf", b"%PDF-1.4\n%%EOF", "application/pdf")})
        request("POST", f"{article_path}/eligibility-decision", json={"decision": "included"})
        wait_until(lambda: point(article_id) is not None and node(article_id), "inclusion reaches both indexes")
        original_vector = point(article_id)["vector"]
        request("PATCH", f"{article_path}/notes", json={"notas": "Updated note"})
        wait_until(lambda: point(article_id)["payload"].get("notas") == "Updated note", "notes reach search payload")
        assert point(article_id)["vector"] == original_vector
        print("PASS notes preserve vector", flush=True)

        subprocess.run(["docker", "stop", worker], check=True, capture_output=True)
        request("PATCH", f"{article_path}/notes", json={"notas": "Pending restart"})
        assert point(article_id)["payload"].get("notas") == "Updated note"
        subprocess.run(["docker", "start", worker], check=True, capture_output=True)
        wait_until(lambda: point(article_id)["payload"].get("notas") == "Pending restart", "worker restart recovers pending job")
        request("DELETE", article_path)
        wait_until(lambda: point(article_id) is None and not node(article_id), "deletion removes both indexes")
    finally:
        subprocess.run(["docker", "start", worker], capture_output=True)
        if project_id is not None:
            request("DELETE", f"/api/projetos/{project_id}")
        client.close()
        vector.close()


if __name__ == "__main__":
    main()
