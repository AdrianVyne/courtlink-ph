# Local Full Docker Design

## Purpose

Provide a one-command local Docker workflow that runs the full CourtLink PH application stack, including object storage, and serves the website at `http://localhost` without requiring Node processes on the host.

## Scope

This change adds a dedicated local full-stack compose definition and updates local run documentation. It does not change product behavior, service responsibilities, tenant authorization, or the deployment-oriented production compose flow.

## Goals

- Add a single local compose entrypoint for the full stack.
- Keep local container topology close to the production stack.
- Preserve the existing lightweight dependency-only compose file for host-based development.
- Avoid introducing local-only behavior into the production compose file.

## Non-goals

- Automatic database seeding on container startup.
- Replacing the existing `compose.yaml` dependency stack.
- Changing production deployment defaults or Oracle-hosted operational guidance.

## Current state

The repository currently supports two partial paths:

- `compose.yaml` starts only local dependencies: PostgreSQL, Redis, and MinIO.
- `compose.prod.yaml` starts the full app stack, but assumes an external S3-compatible object storage endpoint and is documented for deployment use.

This leaves no supported one-command local Docker path for the complete application.

## Proposed approach

Add `compose.full.yaml`, a localhost-oriented compose file that mirrors the production service graph while including MinIO as the local S3-compatible object store.

The service graph will be:

- `postgres`
- `redis`
- `minio`
- `migrate`
- `api`
- `worker`
- `web`
- `caddy`

This preserves the same runtime separation already used in production:

- `migrate` runs once and must complete before application services start.
- `api` owns the REST surface and storage integration.
- `worker` handles background jobs.
- `web` serves the Next.js app.
- `caddy` remains the browser-facing entrypoint and keeps API traffic same-origin.

## Configuration

`compose.full.yaml` will use safe local defaults directly in the compose file where appropriate, and `.env` overrides where the repository already expects them.

Key local defaults:

- Postgres credentials remain `courtlink` / `courtlink`.
- `DATABASE_URL` resolves to `postgresql://courtlink:courtlink@postgres:5432/courtlink?schema=public`.
- `REDIS_URL` resolves to `redis://redis:6379`.
- `APP_BASE_URL` and `SITE_URL` default to `http://localhost`.
- `SITE_ADDRESS` defaults to `:80`.
- Object storage points at `http://minio:9000`.
- MinIO credentials default to `courtlink` / `courtlink-dev-secret`.
- `OBJECT_STORAGE_BUCKET` defaults to `courtlink-private`.
- `OBJECT_STORAGE_FORCE_PATH_STYLE` remains `true`.

Required local secrets that are still explicit:

- `SESSION_SECRET`
- `ENCRYPTION_KEY`

These stay configurable through `.env` so local operators can replace defaults instead of baking secrets into source.

## Networking and access

The local browser entrypoint remains `caddy`.

- `caddy` exposes `80:80`, making the site available at `http://localhost`.
- `minio` exposes `9000:9000` and `9001:9001` for S3 access and the MinIO console.
- Internal service-to-service traffic uses compose service names.

Caddy routing stays unchanged:

- `/api/*` proxies to `api:3001`
- all other routes proxy to `web:3000`

This keeps browser cookies same-origin and avoids local cross-origin auth differences.

## Data initialization

Database migration remains automatic through the existing `migrate` service.

Database seeding remains explicit:

- Base startup command: `docker compose -f compose.full.yaml up -d --build`
- Demo data seed command: `docker compose -f compose.full.yaml run --rm migrate pnpm --filter @courtlink/database db:seed`

This avoids hidden state changes during first boot while still supporting a documented demo workflow.

MinIO bucket bootstrapping does not need a dedicated bootstrap service. The existing API storage implementation already attempts `HeadBucket` and falls back to `CreateBucket`, which is sufficient for local MinIO startup and remains compatible with pre-provisioned production buckets.

## Documentation changes

Update the README local development section to distinguish:

- dependency-only local development with `compose.yaml` plus host `pnpm dev`
- full-Docker local development with `compose.full.yaml`

Update deployment documentation only as needed to point local operators at the dedicated full-Docker compose file instead of implying that `compose.prod.yaml` is the recommended local full-stack path.

The documented local access points will be:

- Website: `http://localhost`
- API readiness: `http://localhost/api/v1/health/ready`
- MinIO console: `http://localhost:9001`

## Verification

Verification for this change should be operational rather than application-level unit testing:

1. `docker compose -f compose.full.yaml config` succeeds.
2. `docker compose -f compose.full.yaml up -d --build` completes.
3. `docker compose -f compose.full.yaml ps` shows healthy or completed-required services.
4. `docker compose -f compose.full.yaml run --rm migrate pnpm --filter @courtlink/database db:seed` succeeds.
5. `http://localhost/api/v1/health/ready` returns success.
6. `http://localhost` returns the web app through Caddy.

## Risks and mitigations

### Drift from production

Risk: A separate local compose file can diverge from the production topology.

Mitigation: Mirror the production service graph and reuse the same Dockerfile targets, health checks, and proxy configuration wherever possible. Keep local-only differences limited to MinIO inclusion, localhost defaults, and exposed ports.

### Local secret confusion

Risk: Users may assume unsafe local defaults are suitable for deployment.

Mitigation: Keep deployment documentation centered on `compose.prod.yaml` and clearly label `compose.full.yaml` as local-only.

### Seed timing confusion

Risk: Users may expect demo data immediately after `up`.

Mitigation: Document seeding as a separate explicit step and keep the command next to the startup instructions.
