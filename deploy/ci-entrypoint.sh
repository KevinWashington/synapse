#!/usr/bin/env bash
set -euo pipefail
if [[ "${SSH_ORIGINAL_COMMAND:-}" =~ ^deploy\ ([a-f0-9]{40})$ ]]; then
    exec sudo -n /usr/bin/bash /home/ubuntu/Synapse/scripts/receive-production.sh "${BASH_REMATCH[1]}"
fi
echo 'This key permits only a Synapse production deployment.' >&2
exit 1
