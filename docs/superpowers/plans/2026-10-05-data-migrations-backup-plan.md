# Data Migrations and Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a verified backup, versioned PostgreSQL migrations, and production-safe runtime validation before changing authentication data.

**Architecture:** PostgreSQL remains authoritative. Alembic replaces startup-time DDL, while explicit PowerShell backup/restore tooling captures the current Docker database and produces a checksum manifest and restore report before any schema change.

**Tech Stack:** PostgreSQL 16, SQLAlchemy 2 async, Alembic, FastAPI, Docker Compose, PowerShell, pytest.

**Spec:** `docs/superpowers/specs/2026-10-05-google-auth-deepseek-production-audit-design.md`

## Global Constraints

- Preserve all existing users, projects, articles, decisions, evidence, and ownership relationships.
- Do not overwrite, reformat, discard, stage, or commit unrelated working-tree changes.
- Backup files and secret material stay outside Git.
- A shared `DEEPSEEK_API_KEY` must not be a startup requirement after this plan.
- Production startup must fail clearly for missing security configuration or a database revision mismatch.

## Review Focus

- An empty database upgrades to the complete current schema without `create_all` side effects; prove in `backend/tests/test_migrations.py`.
- An existing pre-Alembic database can be stamped and upgraded without recreating or losing rows; prove with the legacy-schema fixture in `backend/tests/test_migrations.py`.
- A failed or partial dump never receives a successful manifest; prove with the backup script's `-ValidateOnly` failure case.
- A restore targets only the explicitly named temporary database and rejects the production database name; prove with script validation output.
- Startup without the shared DeepSeek key succeeds, while missing session/encryption/Google configuration fails outside development; prove in `backend/tests/test_runtime_config.py`.

---

### Task 1: Add Safe Backup and Restore-Verification Tooling

**Files:**
- Modify: `.gitignore`
- Create: `scripts/backup-data.ps1`
- Create: `scripts/verify-backup.ps1`
- Create: `docs/deployment/data-backup.md`

**Interfaces:**
- Consumes: Docker containers `synapse-postgres`, `synapse-neo4j`, and `synapse-qdrant` when available.
- Produces: `backup-data.ps1 -OutputDirectory <absolute-path> -PostgresContainer <name>` and `verify-backup.ps1 -BackupFile <absolute-path> -TemporaryDatabase <name>`; both exit nonzero on unsafe or incomplete operations.

- [ ] **Step 1: Add backup artifacts to Git ignore rules**

Add `backups/`, `*.dump`, snapshot archives, and backup manifests containing local paths to `.gitignore` without changing existing ignore behavior.

- [ ] **Step 2: Write `scripts/backup-data.ps1` with explicit target validation**

Require absolute output directory and explicit container names. Resolve paths before writing, reject the repository root as an output target, run `pg_dump -Fc`, calculate SHA-256 and size, and record optional Neo4j/Qdrant snapshot outcomes in a timestamped JSON manifest. Never print environment-variable values.

- [ ] **Step 3: Run backup validation against invalid inputs**

Run: `powershell -File scripts/backup-data.ps1 -OutputDirectory . -PostgresContainer synapse-postgres -ValidateOnly`

Expected: nonzero exit with a message that the output directory must be an absolute dedicated directory.

- [ ] **Step 4: Write `scripts/verify-backup.ps1`**

Require a custom-format dump, verify its checksum against the manifest, reject `synapse` and the configured production database as restore targets, create a named temporary database, restore with `pg_restore`, and query row counts plus orphaned `ownerId`/`projectId` references. Leave cleanup as an explicit final switch rather than implicit deletion.

- [ ] **Step 5: Document exact backup, verification, retention, and cleanup commands**

Include Windows commands, expected artifacts, how to inspect the manifest, and the rule that no migration starts without a successful restore report.

- [ ] **Step 6: Verify scripts parse and documentation has no placeholders**

Run: `powershell -NoProfile -Command "[scriptblock]::Create((Get-Content -Raw scripts/backup-data.ps1)) > $null; [scriptblock]::Create((Get-Content -Raw scripts/verify-backup.ps1)) > $null"`

Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add .gitignore scripts/backup-data.ps1 scripts/verify-backup.ps1 docs/deployment/data-backup.md
git commit -m "chore: add verified data backup workflow"
```

### Task 2: Introduce Alembic and a Complete Baseline Revision

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/alembic.ini`
- Create: `backend/migrations/env.py`
- Create: `backend/migrations/script.py.mako`
- Create: `backend/migrations/versions/0001_existing_schema.py`
- Create: `backend/tests/test_migrations.py`
- Modify: `backend/app/database.py`

**Interfaces:**
- Consumes: `app.database.Base.metadata` and `DATABASE_URL`.
- Produces: `alembic upgrade head`, `alembic downgrade <revision>`, and `assert_database_revision(engine) -> None`.

- [ ] **Step 1: Write failing migration tests**

Add `test_empty_database_upgrades_to_baseline_schema`, `test_legacy_database_can_be_stamped_without_row_loss`, and `test_database_revision_mismatch_is_reported`. Assert the presence of every model table and the columns currently created by `init_db`, plus unchanged representative row counts.

- [ ] **Step 2: Run migration tests and verify RED**

Run: `.venv\Scripts\python.exe -m pytest backend/tests/test_migrations.py -v`

Expected: FAIL because Alembic configuration and `assert_database_revision` do not exist.

- [ ] **Step 3: Add Alembic dependency and async migration environment**

Pin a compatible Alembic version in `backend/requirements.txt`; configure `env.py` to import every model and translate the async SQLAlchemy URL for online migrations without embedding credentials in files.

- [ ] **Step 4: Create `0001_existing_schema`**

The upgrade creates the complete schema represented by current models and the legacy DDL in `init_db`. The downgrade removes only objects created by the revision, in dependency-safe order.

- [ ] **Step 5: Replace startup DDL with revision validation**

Remove `create_all` and inline `ALTER TABLE` statements from `init_db`. Implement `async def assert_database_revision() -> None` and make `init_db()` call it without mutating the schema.

- [ ] **Step 6: Run migration tests and verify GREEN**

Run: `.venv\Scripts\python.exe -m pytest backend/tests/test_migrations.py -v`

Expected: all migration tests PASS.

- [ ] **Step 7: Run the existing backend suite**

Run: `.venv\Scripts\python.exe -m pytest backend/tests -v`

Expected: all tests pass; record any pre-existing failures by name before proceeding.

- [ ] **Step 8: Commit**

```bash
git add backend/requirements.txt backend/alembic.ini backend/migrations backend/tests/test_migrations.py backend/app/database.py
git commit -m "feat: add versioned database migrations"
```

### Task 3: Make Runtime Configuration Production-Safe

**Files:**
- Modify: `backend/app/config.py`
- Modify: `backend/app/main.py`
- Modify: `backend/.env.example`
- Modify: `docker-compose.yml`
- Create: `backend/tests/test_runtime_config.py`

**Interfaces:**
- Produces: `Settings.validate_runtime() -> None`, `Settings.allowed_origins -> list[str]`, `/health` for liveness, and `/ready` for dependency/configuration readiness.

- [ ] **Step 1: Write failing configuration tests**

Add tests named `test_deepseek_key_is_not_required_at_startup`, `test_production_requires_google_session_and_encryption_settings`, `test_allowed_origins_rejects_wildcard_with_credentials`, and `test_ready_reports_revision_failure_without_exposing_secrets`.

- [ ] **Step 2: Run the tests and verify RED**

Run: `.venv\Scripts\python.exe -m pytest backend/tests/test_runtime_config.py -v`

Expected: FAIL on missing settings and current DeepSeek requirement.

- [ ] **Step 3: Define exact runtime settings**

Add `APP_ENV`, `PUBLIC_APP_URL`, `GOOGLE_CLIENT_ID`, `SESSION_SECRET`, `SESSION_COOKIE_NAME`, `SESSION_COOKIE_SECURE`, `SESSION_TTL_MINUTES`, `CREDENTIAL_ENCRYPTION_KEY`, and comma-separated `ALLOWED_ORIGINS`. Keep `DEEPSEEK_MODEL` and `DEEPSEEK_BASE_URL`; remove `DEEPSEEK_API_KEY` from required settings.

- [ ] **Step 4: Configure CORS from the validated allowlist**

Use exact origins for `https://synapse.labit.dev.br`, localhost, and 127.0.0.1. Reject `*` when credentials are enabled.

- [ ] **Step 5: Separate liveness and readiness**

Keep `/health` process-only. Add `/ready` that checks database connectivity and Alembic revision and returns sanitized dependency status with HTTP 503 when not ready.

- [ ] **Step 6: Update example environment and Compose startup**

Document safe development placeholders. Run `alembic upgrade head` before Uvicorn in the backend container command; do not include production secrets or a DeepSeek key.

- [ ] **Step 7: Run tests and build the backend image**

Run: `.venv\Scripts\python.exe -m pytest backend/tests/test_runtime_config.py backend/tests/test_migrations.py -v`

Run: `docker compose build backend`

Expected: tests PASS and image build exits 0.

- [ ] **Step 8: Commit**

```bash
git add backend/app/config.py backend/app/main.py backend/.env.example docker-compose.yml backend/tests/test_runtime_config.py
git commit -m "feat: validate production runtime configuration"
```

### Task 4: Capture and Prove the Current Data Backup

**Files:**
- Create: `docs/audits/2026-10-05-backup-restore-report.md`
- Runtime artifact outside Git: timestamped dump, manifest, optional graph/vector snapshots.

**Interfaces:**
- Consumes: Tasks 1-3 tooling and the current Docker volumes.
- Produces: a restore report containing checksums, row counts, integrity-query results, and snapshot availability without secrets or personal document contents.

- [ ] **Step 1: Start only the required current data services without deleting volumes**

Run: `docker compose up -d postgres neo4j qdrant qdrant-init`

Expected: existing named volumes are reused and services become healthy.

- [ ] **Step 2: Run the backup into a dedicated absolute directory**

Run `scripts/backup-data.ps1` with an absolute directory under `backups/` and the explicit current container names.

Expected: dump and manifest exist; checksum and nonzero size are recorded.

- [ ] **Step 3: Restore into an explicitly named temporary database**

Run `scripts/verify-backup.ps1` with a unique `synapse_restore_check_<timestamp>` target.

Expected: restore succeeds and integrity queries report zero orphaned ownership references.

- [ ] **Step 4: Record sanitized evidence**

Write the dump filename, checksum, size, service versions, row counts, integrity results, and Neo4j/Qdrant snapshot status to the report. Do not commit the dump or local absolute paths containing usernames.

- [ ] **Step 5: Verify and commit the report**

Run: `git diff --check -- docs/audits/2026-10-05-backup-restore-report.md`

```bash
git add docs/audits/2026-10-05-backup-restore-report.md
git commit -m "docs: record verified pre-migration backup"
```
