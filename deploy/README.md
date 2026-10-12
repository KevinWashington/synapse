# Production on the VPS

URL: https://synapse.labit.dev.br

The production stack runs from `/home/ubuntu/Synapse`. It uses
`docker-compose.production.yml` and the untracked, mode-0600 `production.env`.
Copy `production.env.example` when configuring another host, supply the Google
Client ID and Hugging Face token, and generate strong independent passwords,
a session secret, and a Fernet credential encryption key.

Run from the repository with Docker permissions:

```sh
sudo bash scripts/deploy-production.sh
```

The script builds before replacing containers, makes and verifies a full backup,
starts both workers, waits for health checks, and checks the public HTTPS
deployment. It retains previous images, Compose configuration, environment and
host Nginx configuration. Failed releases restore the previous application
images/configuration without restoring or deleting database volumes.

**Schema changes are intentionally refused by unattended deployment.** The
backend requires an exact Alembic revision, so reverting an image after a schema
upgrade would fail. A schema-changing release needs a separately tested migration
and recovery procedure. The gate runs before production changes.

`Deploy production` runs after `Quality` succeeds on `main`. It builds both
images on the GitHub runner and streams them over pinned-host SSH to the VPS.
The dedicated key is restricted to `deploy <40-character SHA>`; shell, forwarding
and PTY access are disabled. Only the current `main` SHA is accepted. Runtime
secrets remain on the VPS; only the public Google Client ID is used for building.
Immutable code releases live in `/home/ubuntu/synapse-releases/<sha>`;
`/home/ubuntu/synapse-current` identifies the successful current release.

## Backups and recovery

`synapse-backup.timer` runs daily at **03:30 America/Fortaleza**. Each backup
briefly stops API/workers and then databases for a clean archive. The static
frontend continues to serve; API requests are unavailable during this window.
Original containers are restarted even when archiving fails. The service has
signal cleanup and a systemd recovery fallback. Deploys and backups share a lock.

Recovery sets in `/home/ubuntu/synapse-backups/production/<timestamp>` contain
a PostgreSQL custom dump, clean archives of every database mount, actual
production credentials (including the encryption key), deployment configuration,
image identities and SHA-256 checksums. Mode 0700 directories and umask 0077
protect these files. `VERIFIED` appears only after all archives are read, checksums
match, and a real isolated PostgreSQL restoration matches every table row count.
Backups and previous images are **never automatically pruned**. Monitor disk
usage and copy verified backups to independent storage; a backup on the VPS
alone does not protect against total loss of the VPS.

```sh
sudo python3 /home/ubuntu/synapse-current/scripts/backup-production.py
sudo python3 /home/ubuntu/synapse-current/scripts/backup-production.py --verify /absolute/backup/path
systemctl list-timers synapse-backup.timer
journalctl -u synapse-backup.service --since today
```

Before restoring, stop application writers and preserve the current volumes in a
new recovery set. Restore into **new** volumes/containers first, using the image
IDs in `manifest.json`. Verify data and health before redirecting production.
Never overwrite the only production copy or run `down -v`. Configuration archives
contain credentials and must not be published or committed.

## Host maintenance

The legacy PostgreSQL external port 5432 is restricted by the narrowly scoped
`restrict-legacy-postgres.service`, including IPv6 and Docker forwarding. Local
and Docker consumers and established connections remain permitted. SSH tunnels
can be used for administrative database access. Existing firewall and database
backups are stored in `/home/ubuntu/synapse-backups/maintenance-20261012`.

Ubuntu security unattended upgrades are enabled. The pending general OS/Docker
upgrade and reboot must use a maintenance window covering **all** hosted
applications: verify independent backups for their databases/files, preserve
package versions and `/etc`, keep old kernels, upgrade without autoremove, then
verify every container, Nginx virtual host and the PostgreSQL restriction after
reboot. Synapse backups do not cover unrelated MySQL/MinIO applications.

Nginx on the host uses `deploy/nginx/synapse.conf`, proxying the frontend through
`127.0.0.1:13000` and API through `127.0.0.1:15000`. Database ports are private
to the Compose network. Each database has a separate persistent production
volume. Do not use `docker compose down -v` against this stack.

The Google OAuth Web client must authorize `https://synapse.labit.dev.br` as a
JavaScript origin. Confirm Google sign-in with a real account after setup.
Each user supplies their own optional DeepSeek key in the application.

Inspect status and logs with the same project and configuration:

```sh
docker compose --env-file production.env -p synapse-production -f docker-compose.production.yml ps -a
docker compose --env-file production.env -p synapse-production -f docker-compose.production.yml logs --tail 100 backend synthesis-worker index-worker
```
