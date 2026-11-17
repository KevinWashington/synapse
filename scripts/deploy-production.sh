#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
test "$(id -u)" = 0 || { echo 'Run with sudo so backups preserve volume ownership.' >&2; exit 1; }
exec 9>/var/lock/synapse-production.lock
flock 9
if [[ "${1:-}" == --prebuilt ]]; then
    latest="$(git ls-remote https://github.com/KevinWashington/synapse.git refs/heads/main | cut -f1)"
    test "$latest" = "${SYNAPSE_IMAGE_TAG:?Release SHA required}" || { echo 'Refusing queued stale deployment' >&2; exit 1; }
fi
compose=(docker compose --env-file production.env -p synapse-production -f docker-compose.production.yml)
"${compose[@]}" config --quiet
if [[ "${1:-}" != --prebuilt ]]; then
    "${compose[@]}" build backend frontend
fi
# The application requires an exact Alembic head. A schema change is deployed
# only when it is a forward path from the deployed revision whose every step has
# a real downgrade. The `migrate` service upgrades after the verified backup below;
# if the release then fails, rollback downgrades to the previous revision before
# restoring the previous images (which require that exact revision).
release_image="synapse-backend:${SYNAPSE_IMAGE_TAG:-production}"
head_command="from alembic.config import Config; from alembic.script import ScriptDirectory; c=Config('/app/alembic.ini'); c.set_main_option('script_location','/app/migrations'); print(ScriptDirectory.from_config(c).get_current_head())"
new_head="$(docker run --rm --network none --entrypoint python "$release_image" -c "$head_command")"
current_head="$(docker exec synapse-postgres psql -U synapse -d synapse -Atc 'SELECT version_num FROM alembic_version')"
schema_change=0
if [[ "$new_head" != "$current_head" ]]; then
    if ! docker run --rm -i --network none --entrypoint python "$release_image" - "$current_head" <<'PY'
import inspect
import sys

from alembic.config import Config
from alembic.script import ScriptDirectory

config = Config("/app/alembic.ini")
config.set_main_option("script_location", "/app/migrations")
script = ScriptDirectory.from_config(config)
current = sys.argv[1]
# Raises when the deployed revision is not an ancestor of the release head.
steps = [rev for rev in script.iterate_revisions(script.get_current_head(), current) if rev.revision != current]
for rev in steps:
    body = [
        line.strip()
        for line in inspect.getsource(rev.module.downgrade).splitlines()[1:]
        if line.strip() and not line.strip().startswith(("#", '"""'))
    ]
    if body in ([], ["pass"]):
        raise SystemExit(f"Migration {rev.revision} has no downgrade; refusing unattended deployment.")
print(f"Reversible schema path from {current}: {', '.join(rev.revision for rev in reversed(steps))}")
PY
    then
        echo "Schema change $current_head -> $new_head is not a reversible forward path: automatic deployment refused before modifying production." >&2
        exit 1
    fi
    schema_change=1
fi
# Verified backup (isolated restore must match every table) before any change.
python3 scripts/backup-production.py --lock-held
rollback="rollback-$(date -u +%Y%m%dT%H%M%S)"
docker image tag "$(docker inspect synapse-backend --format '{{.Image}}')" "synapse-backend:$rollback"
docker image tag "$(docker inspect synapse-frontend --format '{{.Image}}')" "synapse-frontend:$rollback"
mkdir -p /home/ubuntu/synapse-backups/deployments
record="/home/ubuntu/synapse-backups/deployments/$rollback"
mkdir -m 700 "$record"
active="$(readlink -f /home/ubuntu/synapse-current)"
cp "$active/docker-compose.production.yml" "$record/compose.yml"
cp "$active/production.env" "$record/production.env"
cp /etc/nginx/conf.d/synapse-production.conf "$record/nginx.conf"
rollback_on_error() {
    echo "Deploy failed. Restoring previous application images; database volumes are retained. Recovery record: $record" >&2
    if [[ "$schema_change" == 1 ]]; then
        # Previous images require the previous revision: stop the release and downgrade first.
        "${compose[@]}" stop backend synthesis-worker index-worker || true
        if ! "${compose[@]}" run --rm --no-deps -T migrate python -c             "from alembic import command; from app.config import settings; from migrate_database import _alembic_config; command.downgrade(_alembic_config(settings.DATABASE_URL), '$current_head')"; then
            echo "Schema downgrade to $current_head failed. Previous images were not started; restore the verified backup in /home/ubuntu/synapse-backups/production." >&2
            exit 1
        fi
        echo "Schema downgraded to $current_head." >&2
    fi
    cp "$record/nginx.conf" /etc/nginx/conf.d/synapse-production.conf
    nginx -t && systemctl reload nginx
    SYNAPSE_IMAGE_TAG="$rollback" docker compose --env-file "$record/production.env" -p synapse-production -f "$record/compose.yml" \
        up -d --no-deps --no-build --wait --wait-timeout 300 backend frontend synthesis-worker index-worker
    exit 1
}
trap rollback_on_error ERR
"${compose[@]}" up -d --no-build --wait --wait-timeout 300 backend frontend synthesis-worker index-worker
cp deploy/nginx/synapse.conf /etc/nginx/conf.d/synapse-production.conf
nginx -t
systemctl reload nginx
python3 scripts/check-production-http.py https://synapse.labit.dev.br
trap - ERR
printf '%s\n' "${SYNAPSE_IMAGE_TAG:-production}" > "$record/deployed-image-tag"
ln -sfn "$(pwd -P)" /home/ubuntu/synapse-current
echo "PASS: deployment verified; rollback images retained as $rollback"
