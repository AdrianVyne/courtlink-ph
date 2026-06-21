# CourtLink PH

CourtLink PH is an open-source, pickleball-only marketplace for booking courts and coaches across the Philippines.

The project is in active development. Product decisions are documented in `docs/superpowers/specs`, implementation work in `docs/superpowers/plans`, and architecture decisions in `docs/adr`.

## Stack

- Next.js web application
- NestJS REST API and background worker
- PostgreSQL, Redis/BullMQ, and OCI Object Storage
- Docker Compose on Oracle Cloud Always Free

## Local development

Prerequisites: Node 24+, pnpm 11, and Docker.

```bash
docker compose up -d                       # Postgres (5433) and Redis (6379)
pnpm install
export DATABASE_URL=postgresql://courtlink:courtlink@localhost:5433/courtlink
pnpm --filter @courtlink/database db:migrate
pnpm --filter @courtlink/database db:seed   # optional demo venue, court, and coach
pnpm dev                                    # web on :3000, API on :3001
```

The web app proxies `/api/*` to the API (`API_PROXY_TARGET`, default `http://localhost:3001`), so sessions use same-origin HTTP-only cookies. The seed prints a shared demo password for the `*@demo.courtlink.ph` accounts.

## Verification

```bash
pnpm check             # format, lint, typecheck, unit tests, builds
pnpm test:integration  # requires Postgres and DATABASE_URL
```

## License

CourtLink PH is licensed under the GNU Affero General Public License v3.0. See `LICENSE`.
