#!/usr/bin/env bash
# Last-resort systemd timeout recovery; do not race a running deployment.
set -euo pipefail
exec 9>/var/lock/synapse-production.lock
flock -w 300 9
test -f /run/synapse-backup-needs-recovery || exit 0
for service in postgres neo4j qdrant backend synthesis-worker index-worker; do
    docker start "synapse-$service" || true
done
