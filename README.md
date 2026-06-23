# CourtLink PH

> **Live demo:** _Coming soon ? will be hosted on Oracle Cloud Always Free_
>
> The production deployment guide is at [`docs/deployment.md`](docs/deployment.md).

CourtLink PH is an open-source, pickleball-only marketplace for booking courts and coaches across the Philippines. Businesses list their venues and courts, players discover and book them with direct payments (GCash, Maya, QR Ph, bank transfer), and coaches offer private or group sessions through an open marketplace.

## Features

- **Multi-role accounts** ? Player, Coach, Venue Owner/Manager/Staff, and Super Admin in one login
- **Court booking** ? Real-time slot availability, 5-minute payment holds, manual proof-of-payment review with photo upload
- **Coach marketplace** ? Directed requests, open job board with competitive offers, atomic winner selection
- **Google OAuth** ? Optional sign-in with PKCE, nonce, and one-time state protection
- **Nationwide discovery** ? Filter by city, amenities, price range, and availability across Philippine regions
- **Payment proof** ? Private encrypted uploads (AES-256-GCM), safe image re-encoding, short-lived signed URLs
- **Reviews & ratings** ? Only completed-booking participants can review; aggregated venue and coach ratings
- **Notifications** ? In-app + optional SMTP transactional email (Brevo free tier compatible)
- **Moderation** ? Report, suspend/reinstate, audit trail for super admins
- **PWA** ? Installable progressive web app with offline support
- **Operations dashboard** ? Health checks, capacity metrics, queue visibility, retained failed jobs, encrypted backups

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Web | Next.js 16, React 19, Tailwind CSS 4, Lucide icons |
| API | NestJS 11, Fastify, Zod, OpenAPI/Swagger |
| Worker | BullMQ background jobs (hold expiry, review escalation, booking completion) |
| Database | PostgreSQL 17, Prisma 7, GiST overlap exclusion constraints |
| Cache/Queue | Redis 7 |
| Storage | S3-compatible Object Storage (OCI/MinIO) |
| Auth | Argon2id passwords, HTTP-only sessions, Google OAuth (PKCE+S256) |
| Testing | Vitest (240+ unit tests), 83 integration tests, Playwright + axe-core for e2e/accessibility |
| Infrastructure | Docker multi-stage builds, Caddy reverse proxy, Docker Compose |
| Hosting | Oracle Cloud Always Free (ARM/A1), DuckDNS for free HTTPS domain |

## Architecture

```
Browser ??? Caddy (TLS) ????? Next.js Web (:3000)
                           ??? NestJS API (:3001) ????? PostgreSQL
                                                    ??? Redis / BullMQ
                                Worker ???????????????? Object Storage
```

A pnpm/Turborepo monorepo with strict TypeScript, domain-driven service architecture, and tenant-authorized API routes. All timestamps stored in UTC, presented in Asia/Manila.

## Local development

Prerequisites: Node 24+, pnpm 11, and Docker.

```bash
docker compose up -d                       # Postgres (5433), Redis (6379), MinIO (9000)
pnpm install
export DATABASE_URL=postgresql://courtlink:courtlink@localhost:5433/courtlink
pnpm --filter @courtlink/database db:migrate
pnpm --filter @courtlink/database db:seed   # demo accounts: player@/owner@/coach@/admin@demo.courtlink.ph
pnpm dev                                    # web on :3000, API on :3001
```

Demo password: `courtlink-demo-2026`

## Verification

```bash
pnpm check             # format, lint, typecheck, 240+ unit tests, production builds (18 tasks)
pnpm test:integration  # 83 tests across 8 task groups (needs Postgres + DATABASE_URL)
```

## Deployment (free)

This stack runs entirely within [Oracle Cloud Always Free](https://www.oracle.com/cloud/free/) limits:

- **VM:** 1x Ampere A1 Flex (2 OCPU, 6 GB RAM) ? stack uses ~3.2 GB
- **Storage:** 200 GB block + 10 GB Object Storage
- **Domain:** Free subdomain via [DuckDNS](https://www.duckdns.org) with automatic HTTPS from Caddy
- **Email:** Free SMTP via [Brevo](https://www.brevo.com) (300 emails/day)

See [`docs/deployment.md`](docs/deployment.md) for step-by-step instructions.

## Project documentation

- [`docs/superpowers/specs/`](docs/superpowers/specs/) ? Product design specifications
- [`docs/superpowers/plans/`](docs/superpowers/plans/) ? Implementation plans
- [`docs/adr/`](docs/adr/) ? Architecture Decision Records
- [`docs/verification/`](docs/verification/) ? Test and coverage audit reports
- [`docs/runbooks/`](docs/runbooks/) ? Operations, migration, queue recovery, and restore drill runbooks

## License

CourtLink PH is licensed under the GNU Affero General Public License v3.0. See [`LICENSE`](LICENSE).
