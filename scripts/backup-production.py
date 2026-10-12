#!/usr/bin/env python3
"""Complete, clean Synapse backups; verify PostgreSQL in a disposable container.

Run as root. Application writes pause briefly while volumes are archived. No
production volume is deleted or restored by this script. Failed backups remain
for diagnosis and never acquire a VERIFIED marker.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import tarfile
import time
import uuid
from datetime import datetime, timezone

CONTAINERS = ["synapse-postgres", "synapse-neo4j", "synapse-qdrant",
              "synapse-backend", "synapse-synthesis-worker", "synapse-index-worker"]


def run(*args, **kwargs):
    return subprocess.check_output(args, **kwargs)


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def verify_files(directory):
    directory = Path(directory).resolve()
    manifest = json.loads((directory / "manifest.json").read_text())
    if not manifest.get("files"):
        raise ValueError("empty backup manifest")
    for name, checksum in manifest["files"].items():
        path = (directory / name).resolve()
        if path.parent != directory:
            raise ValueError("unsafe backup path")
        if not path.is_file():
            raise ValueError(f"missing backup file: {name}")
        if digest(path) != checksum:
            raise ValueError(f"checksum mismatch: {name}")
    return manifest


def rows(container, database):
    def sql(query):
        return run("docker", "exec", container, "psql", "-U", "synapse", "-d",
                   database, "-At", "-c", query).decode().strip()
    tables = sql("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename").splitlines()
    return {name: int(sql('SELECT count(*) FROM public."' + name.replace('"', '""') + '"'))
            for name in tables}


def wait_healthy(names, timeout=180):
    deadline = time.monotonic() + timeout
    for name in names:
        while True:
            state = json.loads(run("docker", "inspect", name))[0]["State"]
            if state["Running"] and state.get("Health", {}).get("Status", "healthy") == "healthy":
                break
            if time.monotonic() > deadline:
                raise RuntimeError(f"Container did not recover: {name}")
            time.sleep(2)


def verify_postgres(directory):
    manifest = verify_files(directory)
    name = "synapse-restore-check-" + uuid.uuid4().hex[:10]
    try:
        run("docker", "run", "-d", "--name", name, "--network", "none", "--memory", "384m",
            "--tmpfs", "/var/lib/postgresql/data:rw,size=1073741824",
            "-e", "POSTGRES_USER=synapse", "-e", "POSTGRES_DB=restore_check",
            "-e", "POSTGRES_HOST_AUTH_METHOD=trust", manifest["postgres_image"])
        for _ in range(60):
            result = subprocess.run(["docker", "exec", name, "pg_isready", "-U", "synapse"],
                                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if result.returncode == 0:
                break
            time.sleep(1)
        else:
            raise RuntimeError("Isolated restoration database did not start")
        with (Path(directory) / "postgres.dump").open("rb") as stream:
            subprocess.run(["docker", "exec", "-i", name, "pg_restore", "--exit-on-error",
                            "-U", "synapse", "-d", "restore_check"], stdin=stream, check=True)
        if rows(name, "restore_check") != manifest["postgres_rows"]:
            raise RuntimeError("Restored table counts differ from the source")
        for path in Path(directory).glob("*.tar.gz"):
            with tarfile.open(path, "r:gz") as archive:
                for member in archive:
                    if member.isfile():
                        # Read all compressed bytes, detecting truncated/corrupt archives.
                        with archive.extractfile(member) as stream:
                            while stream.read(1024 * 1024):
                                pass
        with tarfile.open(Path(directory) / "configuration.tar.gz", "r:gz") as archive:
            environment = archive.getmember("production.env")
            if not environment.isfile() or environment.size == 0:
                raise RuntimeError("Backup lacks the actual production credentials")
        (Path(directory) / "VERIFIED").write_text(datetime.now(timezone.utc).isoformat() + "\n")
        print(f"PASS: checksums, archives, PostgreSQL restoration and {len(manifest['postgres_rows'])} table counts")
    finally:
        subprocess.run(["docker", "rm", "-f", name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def backup(root, destination):
    if os.geteuid() != 0:
        raise RuntimeError("Run with sudo to archive volume ownership and permissions")
    root, destination = root.resolve(), destination.resolve()
    if destination == root or root in destination.parents:
        raise ValueError("Backup destination must be outside the repository")
    if shutil.disk_usage(destination.parent).free < 2 * 1024**3:
        raise RuntimeError("Less than 2 GiB free; refusing to begin maintenance")
    os.umask(0o077)
    destination.mkdir(parents=True, exist_ok=True, mode=0o700)
    folder = destination / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S.%fZ")
    folder.mkdir(mode=0o700)
    states = {c["Name"].lstrip("/"): c for c in json.loads(run("docker", "inspect", *CONTAINERS))}
    required_bytes = sum(int(run("du", "-sb", mount["Source"]).split()[0])
                         for state in states.values() for mount in state["Mounts"]
                         if mount["Type"] in {"volume", "bind"})
    if shutil.disk_usage(destination).free < required_bytes * 1.1 + 1024**3:
        raise RuntimeError("Insufficient disk headroom for a complete backup; production left running")
    running = [name for name in CONTAINERS if states[name]["State"]["Running"]]
    if len(running) != len(CONTAINERS):
        raise RuntimeError("All production containers must be running before a scheduled backup")
    app = running[3:]
    databases = running[:3]
    manifest = {"created_at": datetime.now(timezone.utc).isoformat(),
                "postgres_image": states["synapse-postgres"]["Image"],
                "containers": {name: {"image": state["Image"], "mounts": state["Mounts"]}
                               for name, state in states.items()}}
    recovery_marker = Path("/run/synapse-backup-needs-recovery")
    recovery_marker.write_text(str(folder) + "\n")
    try:
        run("docker", "stop", "--time", "60", *app)
        manifest["postgres_rows"] = rows("synapse-postgres", "synapse")
        with (folder / "postgres.dump").open("wb") as stream:
            subprocess.run(["docker", "exec", "synapse-postgres", "pg_dump", "-U", "synapse",
                            "-d", "synapse", "-Fc"], stdout=stream, check=True)
        run("docker", "stop", "--time", "60", *databases)
        for name in databases:
            for index, mount in enumerate(states[name]["Mounts"]):
                if mount["Type"] not in {"volume", "bind"}:
                    continue
                run("tar", "-czf", str(folder / f"{name}-volume-{index}.tar.gz"),
                    "-C", mount["Source"], ".")
        run("tar", "--dereference", "-czf", str(folder / "configuration.tar.gz"), "-C", str(root),
            "production.env", "docker-compose.production.yml", "deploy", "scripts")
    finally:
        # Restore the original running services even if dumping or archiving fails.
        errors = []
        for name in databases + app:
            try:
                run("docker", "start", name)
            except subprocess.CalledProcessError:
                errors.append(name)
        wait_healthy(databases + app)
        if errors:
            raise RuntimeError(f"Service restart failed: {errors}")
        recovery_marker.unlink(missing_ok=True)
    manifest["files"] = {path.name: digest(path) for path in folder.iterdir() if path.is_file()}
    (folder / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    verify_postgres(folder)
    print(f"BACKUP={folder}")
    return folder


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--destination", type=Path, default=Path("/home/ubuntu/synapse-backups/production"))
    parser.add_argument("--verify", type=Path)
    parser.add_argument("--lock-held", action="store_true", help="Internal: caller already holds the production lock")
    args = parser.parse_args()
    def terminate(signum, frame):
        raise RuntimeError("Backup interrupted; recovering original services")
    signal.signal(signal.SIGTERM, terminate)
    signal.signal(signal.SIGINT, terminate)
    import fcntl
    if args.lock_held:
        if os.geteuid() != 0:
            raise RuntimeError("Only the root deployment process may supply --lock-held")
        backup(args.root, args.destination)
        return
    # Same lock as the deploy script: scheduled backups cannot race a deployment.
    with open("/var/lock/synapse-production.lock", "a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if args.verify:
            verify_postgres(args.verify)
        else:
            backup(args.root, args.destination)


if __name__ == "__main__":
    main()
