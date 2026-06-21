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
- [ ] Create the public `courtlink-ph` GitHub repository after GitHub CLI authentication is available.

### Task 2: Monorepo and quality gates

- [x] Scaffold pnpm workspace applications and focused shared packages.
- [x] Configure strict TypeScript, formatting, linting, unit tests, coverage, and Turborepo tasks.
- [ ] Add Docker development services and environment validation.
- [x] Add CI for checks, tests, builds, and dependency updates; image publishing follows production Dockerfiles.

### Task 3: Data and API foundations

- [x] Write failing domain and database tests for booking, payment-review, refund, and offer invariants.
- [x] Add Prisma schema and migrations that satisfy tenant, scheduling, and audit invariants.
- [ ] Implement versioned API errors, correlation IDs, health endpoints, idempotency, and OpenAPI generation.
- [ ] Verify migration rollback/forward behavior and integration tests against PostgreSQL.

### Task 4: Authentication and authorization

- [ ] Test and implement email/password registration, verification, login/logout, reset, Google OAuth, and secure sessions.
- [ ] Test and implement platform roles and organization memberships.
- [ ] Enforce tenant authorization in services and prove cross-tenant denial with integration tests.
- [ ] Add venue onboarding, staff invitations, approval, suspension, and audit history.

### Task 5: Court inventory and pricing

- [ ] Test and implement courts, amenities, hours, closures, slot increments, duration bounds, and pricing rules.
- [ ] Test availability across Philippine-time boundaries and closures.
- [ ] Add PostgreSQL overlap protection and concurrency tests.
- [ ] Expose public venue/court discovery and availability contracts.

### Task 6: Court booking and manual payment

- [ ] Test the court-booking state machine and five-minute hold lifecycle.
- [ ] Implement idempotent price quotes and transactional holds.
- [ ] Implement private proof upload, transaction references, staff approval/rejection, and two-hour escalation.
- [ ] Test seven-day refund eligibility, venue-caused cancellation, and manual refund records.

### Task 7: Coach marketplace

- [ ] Test and implement coach profiles, rates, availability, locations, and verification labels.
- [ ] Test direct requests requiring coach approval before payment.
- [ ] Test open player requests, expiring offers, atomic winner selection, and competitor closure.
- [ ] Implement separate coach proof review, cancellation, and refund records.

### Task 8: Web experiences

- [ ] Build the accessible design system and responsive application shell.
- [ ] Build public discovery, venue/court pages, coach directory/profile pages, and SEO metadata.
- [ ] Build player, coach, venue, and super-admin workspaces against generated API contracts.
- [ ] Add in-app notifications, email templates, favorites, promotions, reviews, moderation, and PWA support.

### Task 9: Production operations

- [ ] Add production Compose, Caddy, non-root images, resource limits, health checks, and restart policies.
- [ ] Add OCI Object Storage integration, encrypted PostgreSQL backups, restore tooling, and retention configuration.
- [ ] Add structured redacted logs, metrics/capacity checks, queue visibility, alerts, and runbooks.
- [ ] Verify clean-machine deployment, restart recovery, backup restoration, and migration procedure.

### Task 10: Release verification

- [ ] Run formatting, linting, type checks, unit/integration tests, Playwright, accessibility checks, security scans, and production builds.
- [ ] Verify all approved role, booking, payment, refund, coach-offer, moderation, privacy, and operations scenarios.
- [ ] Review specification coverage and resolve every gap before release.
- [ ] Complete branch integration using the finishing-a-development-branch workflow.

