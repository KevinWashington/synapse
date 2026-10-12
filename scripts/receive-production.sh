#!/usr/bin/env bash
# Dedicated CI key streams prebuilt Docker images; it cannot open a shell.
set -euo pipefail
umask 077
sha="${1:?Commit SHA required}"
[[ "$sha" =~ ^[a-f0-9]{40}$ ]]
test "$(id -u)" = 0
base=/home/ubuntu
repository=https://github.com/KevinWashington/synapse.git
latest="$(git ls-remote "$repository" refs/heads/main | cut -f1)"
test "$latest" = "$sha" || { echo 'Refusing stale/non-main deployment' >&2; exit 1; }
release="$base/synapse-releases/$sha"
mkdir -p "$base/synapse-releases"
if test ! -d "$release/.git"; then
    git clone --quiet --depth 1 --branch main "$repository" "$release"
fi
test "$(git -C "$release" rev-parse HEAD)" = "$sha"
ln -sfn "$base/Synapse/production.env" "$release/production.env"
# Complete image reception and integrity checks before any production changes.
gzip -dc | docker load
docker image inspect "synapse-backend:$sha" "synapse-frontend:$sha" >/dev/null
SYNAPSE_IMAGE_TAG="$sha" bash "$release/scripts/deploy-production.sh" --prebuilt
echo "DEPLOYED=$sha"
