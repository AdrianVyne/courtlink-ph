# Deploying CourtLink PH

This stack runs as Docker containers behind Caddy. It targets an Oracle Cloud
Always Free VM but works on any Docker host.

## Services

- `caddy` terminates HTTP/HTTPS and routes `/api/*` to the API and everything
  else to the web app, so the browser keeps same-origin HttpOnly cookies.
- `web` is the Next.js application.
- `api` is the NestJS REST API.
- `worker` runs scheduled jobs (court hold expiry).
- `postgres` and `redis` are the datastores.
- `migrate` applies database migrations once before `api`/`worker` start.

All three application services come from a single multi-stage `Dockerfile`
(`--target api|worker|web`) and are amd64/arm64 compatible.

## First deploy

1. Install Docker Engine and the Compose plugin on the VM.
2. Copy the repository to the VM (git clone) and create a `.env` from
   `.env.example`. Set strong values for:
   - `POSTGRES_PASSWORD`
   - `DATABASE_URL=postgresql://courtlink:POSTGRES_PASSWORD@postgres:5432/courtlink?schema=public`
   - `REDIS_URL=redis://redis:6379`
   - `SESSION_SECRET` and `ENCRYPTION_KEY` (32+ bytes each)
   - `SITE_ADDRESS` (`:80` for HTTP, or your DuckDNS hostname for automatic TLS)
3. Open VM firewall/security-list ingress for ports 80 and 443.
4. Build and start:

   ```bash
   docker compose -f compose.prod.yaml up -d --build
   ```

5. Confirm health:

   ```bash
   docker compose -f compose.prod.yaml ps
   curl -fsS http://localhost/api/v1/health/live
   curl -fsS http://localhost/api/v1/health/ready
   ```

## Updates

```bash
git pull
docker compose -f compose.prod.yaml up -d --build
```

The `migrate` service runs `prisma migrate deploy` on every start and exits;
`api` and `worker` wait for it to finish before booting.

## Notes

- TLS: when `SITE_ADDRESS` is a public hostname, Caddy obtains and renews
  certificates automatically. Ports 80 and 443 must be reachable.
- Private payment-proof storage uses OCI Object Storage via the same S3 adapter.
- Resource limits in `compose.prod.yaml` are sized for a small Always Free VM
  and can be raised on larger shapes.
- JSON container logs rotate at 10 MiB with five files retained per service.
- Configure the five-minute readiness probe and optional free webhook described
  in `docs/runbooks/operations.md`.
- Super admins inspect dependency, capacity, queue, and retained-failure state at
  `/admin/operations`.

## Backups and restore

Backups are encrypted (AES-256-GCM) `pg_dump` archives uploaded to object
storage by the `backup` compose profile. The encryption key is independent of
the database; keep `BACKUP_ENCRYPTION_KEY` somewhere other than the VM.

Run a backup on demand:

```bash
docker compose -f compose.prod.yaml --profile backup run --rm backup
```

Schedule it from the host crontab (daily at 18:10 UTC):

```cron
10 18 * * * cd /opt/courtlink && docker compose -f compose.prod.yaml --profile backup run --rm backup >> /var/log/courtlink-backup.log 2>&1
```

Each run writes an object like `backups/2026/06/courtlink-<timestamp>.sql.gz.enc`.
Configure an object-storage lifecycle rule on the `backups/` prefix for
retention.

Restore into a database (defaults to `DATABASE_URL`; point it at a scratch
database first to rehearse):

```bash
# from object storage
docker compose -f compose.prod.yaml --profile backup run --rm \
  backup node packages/backup/bin/restore.mjs --s3-key backups/2026/06/courtlink-<timestamp>.sql.gz.enc

# from a local file
docker compose -f compose.prod.yaml --profile backup run --rm \
  -v "$PWD/dump.sql.gz.enc:/tmp/dump.enc" \
  backup node packages/backup/bin/restore.mjs --file /tmp/dump.enc
```

### Monthly restore drill

Follow `docs/runbooks/restore-drill.md`. Restore the latest backup into a
throwaway database and confirm migrations, representative aggregate row counts,
and key constraints. A wrong key or a truncated or tampered archive fails the
restore instead of loading corrupt data.
