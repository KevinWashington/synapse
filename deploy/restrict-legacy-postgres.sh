#!/usr/bin/env bash
# Preserve local/Docker consumers and established connections. Restrict only new
# external PostgreSQL connections, including IPv6 docker-proxy traffic.
set -euo pipefail
interface="$(ip -4 route show default | awk 'NR==1 {print $5}')"
test -n "$interface"
for firewall in iptables ip6tables; do
    if "$firewall" -w -nL DOCKER-USER >/dev/null 2>&1; then
        rule=(-i "$interface" -p tcp -m conntrack --ctstate NEW --ctorigdstport 5432 --ctdir ORIGINAL -m comment --comment synapse-restrict-legacy-postgres -j REJECT)
        "$firewall" -w -C DOCKER-USER "${rule[@]}" 2>/dev/null || "$firewall" -w -I DOCKER-USER 1 "${rule[@]}"
    fi
    rule=(-i "$interface" -p tcp --dport 5432 -m conntrack --ctstate NEW -m comment --comment synapse-restrict-legacy-postgres -j REJECT)
    "$firewall" -w -C INPUT "${rule[@]}" 2>/dev/null || "$firewall" -w -I INPUT 1 "${rule[@]}"
done
