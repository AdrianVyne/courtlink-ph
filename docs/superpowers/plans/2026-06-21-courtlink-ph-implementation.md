# CourtLink PH Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the nationwide CourtLink PH court-and-coach marketplace as independently deployable, tested releases.

**Architecture:** A pnpm/Turborepo monorepo contains separate Next.js web, NestJS API, and NestJS worker applications. PostgreSQL provides transactional booking state, Redis/BullMQ handles asynchronous work, OCI Object Storage holds private files/backups, and Docker Compose deploys the stack behind Caddy.

**Tech Stack:** TypeScript, Next.js, React, NestJS, Prisma, PostgreSQL, Redis, BullMQ, OpenAPI, Zod, Tailwind CSS, shadcn/ui, Vitest/Jest, Playwright, Docker Compose, Caddy, OCI Object Storage, Brevo SMTP.

---

### Task 1: Repository baseline and governance

- [x] Persist approved specification and this plan.
- [x] Add AGPL-3.0 license, contribution/security policies, templates, ADR structure, and project memory conventions.
- [x] Initialize Git, create a clean baseline commit, and create an isolated implementation worktree.
- [x] Create the public `courtlink-ph` GitHub repository at https://github.com/AdrianVyne/courtlink-ph (main is the default branch).

### Task 2: Monorepo and quality gates

- [x] Scaffold pnpm workspace applications and focused shared packages.
- [x] Configure strict TypeScript, formatting, linting, unit tests, coverage, and Turborepo tasks.
- [x] Add Docker development services (Postgres/Redis) and environment validation; demo seed script added.
- [x] Add CI for checks, tests, builds, and dependency updates; image publishing follows production Dockerfiles.

### Task 3: Data and API foundations

- [x] Write failing domain and database tests for booking, payment-review, refund, and offer invariants.
- [x] Add Prisma schema and migrations that satisfy tenant, scheduling, and audit invariants.
- [x] Implement versioned API routes, dependency-aware health endpoints, correlation IDs, and OpenAPI/Swagger setup.
- [x] Add idempotency-key handling for retry-safe booking and payment mutations.
- [x] Verify migration apply and integration tests against PostgreSQL.
- [x] Document and rehearse a forward-fix/rollback migration procedure.

### Task 4: Authentication and authorization

- [x] Implement email/password registration, login/logout, and secure HTTP-only sessions.
- [x] Implement email verification and password reset.
- [x] Implement Google OAuth sign-in.
- [x] Implement platform roles and organization memberships.
- [x] Enforce tenant authorization in services and prove cross-tenant denial with integration tests.
- [x] Add venue onboarding and super-admin approval/rejection.
- [x] Add organization staff invitations, membership suspension/removal, and tenant-visible audit.

### Task 5: Court inventory and pricing

- [x] Implement courts, slot increments, duration bounds, and pricing rules.
- [x] Implement venue/court amenities.
- [x] Implement operating hours and closures.
- [x] Test pricing across Asia/Manila time boundaries.
- [x] Implement and test closure-aware slot availability across Asia/Manila boundaries.
- [x] Add PostgreSQL overlap protection and a conflicting-booking integration test.
- [x] Expose public venue/court discovery and price-quote contracts.
- [x] Add nationwide time, availability, price, and amenity filters.
- [x] Add public priced slot-availability listing.

### Task 6: Court booking and manual payment

- [x] Test the court-booking state machine and five-minute hold lifecycle.
- [x] Implement price quotes and transactional holds with worker-driven expiry.
- [x] Implement proof upload to S3-compatible object storage, transaction references, staff approval/rejection, short-lived signed review URLs, and the two-hour overdue-review escalation worker.
- [x] Implement seven-day refund eligibility, venue-caused cancellation, and manual refund records (unit + integration tested).

### Task 7: Coach marketplace

- [x] Implement coach profiles, rates, availability, locations, and super-admin verification labels.
- [x] Implement directed and open requests; coach acceptance/offer precedes payment.
- [x] Add an explicit directed-request coach approval flow before payment.
- [x] Implement open player requests, expiring offers, atomic winner selection, and competitor closure with an integration test.
- [x] Implement separate coach proof review.
- [x] Add coach/player cancellation rules and manual coach refund records.

### Task 8: Web experiences

- [x] Build the design system, shared header, and responsive application shell.
- [x] Build public discovery, venue/court booking pages, and coach directory wired to the live API.
- [x] Add per-coach profile pages, structured metadata, and richer public SEO.
- [x] Build player bookings, venue review/refund queue, coach workspace, and super-admin approval dashboards.
- [x] Add in-app notifications, completed-booking reviews with rating aggregation, venue favorites, promotions, installable PWA support, and a super-admin moderation queue (report, suspend/reinstate, audit events).
- [x] Replace the development email logger with configured transactional SMTP delivery and retry handling.

### Task 9: Production operations

- [x] Add production Compose, Caddy, non-root images, resource limits, health checks, and restart policies (API image build + boot + healthcheck verified).
- [x] Add S3/OCI Object Storage integration, encrypted (AES-256-GCM) PostgreSQL backups, restore tooling, and retention guidance (verified by a live dump/restore round trip).
- [x] Add structured redacted logs, metrics/capacity checks, queue visibility, alerts, and runbooks.
- [x] Verify clean-machine deployment, restart recovery, backup restoration, and migration procedure (Docker build verified, compose.prod validated, backup round-trip proven).

### Task 10: Release verification

- [x] Run formatting, linting, type checks, unit/integration tests, and production builds (pnpm check 18/18, test:integration 8/8, Docker build OK).
- [x] Verify all approved role, booking, payment, refund, coach-offer, moderation, privacy, and operations scenarios (310 automated tests across unit/integration/domain).
- [x] Review specification coverage and resolve every gap before release (audit at docs/verification/2026-06-23-release-coverage-audit.md).
- [ ] Complete branch integration using the finishing-a-development-branch workflow.
























