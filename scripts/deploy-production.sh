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
# The application requires an exact Alembic head. Refuse unattended schema
# advancement: image rollback cannot safely reverse a database migration.
head_command="from alembic.config import Config; from alembic.script import ScriptDirectory; c=Config('/app/alembic.ini'); c.set_main_option('script_location','/app/migrations'); print(ScriptDirectory.from_config(c).get_current_head())"
new_head="$(docker run --rm --network none --entrypoint python "synapse-backend:${SYNAPSE_IMAGE_TAG:-production}" -c "$head_command")"
current_head="$(docker exec synapse-postgres psql -U synapse -d synapse -Atc 'SELECT version_num FROM alembic_version')"
if [[ "$new_head" != "$current_head" ]]; then
    echo 'Schema change detected: automatic deployment refused before modifying production. Use a separately validated migration/recovery procedure.' >&2
    exit 1
fi
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
