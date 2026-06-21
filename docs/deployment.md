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
- Backups and private payment-proof storage (OCI Object Storage) are tracked as
  follow-up operational work in the implementation plan.
- Resource limits in `compose.prod.yaml` are sized for a small Always Free VM
  and can be raised on larger shapes.
