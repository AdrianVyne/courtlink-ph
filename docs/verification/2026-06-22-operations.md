# Operations Verification - 2026-06-22

## Automated gates

- `pnpm check`: 18 of 18 tasks successful; 105 API unit tests, 8 worker unit tests, 5 web tests, 11 domain tests, 7 backup tests, all typechecks, and all production builds passed.
- `pnpm test:integration`: 8 of 8 task groups successful; 23 API integration scenarios, 3 worker integration scenarios, the PostgreSQL overlap test, and supporting package suites passed.
- `docker compose -f compose.prod.yaml config --quiet`: production Compose configuration valid with required environment supplied.
- `sh -n deploy/check-health.sh`: health probe script syntax valid in the production Alpine container environment.

## Production-stack checks

- Rebuilt API, worker, web, and migration images from the committed lockfile.
- Applied migrations to a fresh production Compose PostgreSQL volume.
- Confirmed PostgreSQL, Redis, API, and web container health.
- Confirmed `GET /api/v1/health/live` and `GET /api/v1/health/ready` return HTTP 200 through Caddy.
- Confirmed a caller UUID is returned as `x-correlation-id`.
- Seeded the isolated production test database and authenticated as the demo super admin.
- Confirmed `GET /api/v1/operations/status` reports PostgreSQL and Redis ready, all three queues, overall `ok`, and zero alerts.
- Restarted the API container, waited on readiness, and confirmed the existing database-backed session and operations endpoint still work.
- Counted 25 JSON request-completion events and two JSON startup events after the probe.
- Searched API logs for the local database password, session secret, demo email/password, cookie name, payment-reference key, and proof-URL key; found zero matches.
- Installed OpenSSL in the shared image base, rebuilt the API image, observed zero Prisma OpenSSL warnings, and reconfirmed readiness.

## Scope note

This report proves the operations slice and local production Compose recovery. It does not by itself prove a clean Oracle VM deployment, external TLS/DNS, webhook delivery, or a new monthly restore drill; those remain deployment/release gates in the main implementation plan.
