# Google OAuth Sign-In Implementation Plan

> **For agentic workers:** Implement this plan task-by-task with test-driven development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure Google authorization-code sign-in while preserving CourtLink's API-owned sessions and account model.

**Architecture:** A framework-independent service coordinates one-time PostgreSQL attempts, a replaceable Google client, transactional identity linking, and existing session issuance. NestJS handles redirects/cookies; Next.js renders the opt-in login experience.

**Tech Stack:** TypeScript, NestJS, Prisma, PostgreSQL, `google-auth-library`, Next.js, React, Vitest

---

### Task 1: OAuth policy and environment

**Files:**
- Create: `apps/api/src/auth/google-oauth.service.test.ts`
- Create: `apps/api/src/auth/google-oauth.service.ts`
- Modify: `apps/api/src/config/environment.test.ts`
- Modify: `apps/api/src/config/environment.ts`

- [ ] Write failing tests for safe return paths, disabled configuration, state/nonce/PKCE generation, expiry, and invalid identities.
- [ ] Run `pnpm --filter @courtlink/api test -- src/auth/google-oauth.service.test.ts src/config/environment.test.ts` and observe missing service/config failures.
- [ ] Implement pure policy helpers, service interfaces, stable errors, and conditional environment validation.
- [ ] Run the focused tests and API typecheck.

### Task 2: Persistence and transactional linking

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/20260623140000_google_oauth_attempts/migration.sql`
- Create: `apps/api/src/auth/prisma-google-oauth.repository.ts`
- Create: `apps/api/integration/google-oauth-flow.test.ts`
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/auth/auth.service.test.ts`
- Modify: `apps/api/src/auth/prisma-account-security.repository.ts`

- [ ] Write failing session-issuer and PostgreSQL tests for one-time attempts, existing-subject reuse, verified-email linking, new player creation, suspended denial, and concurrent linking.
- [ ] Add the attempt model/migration and repository transaction.
- [ ] Reuse one session issuer for password and OAuth login.
- [ ] Upsert password credentials during reset for OAuth-only users.
- [ ] Run focused unit/integration tests and database typecheck.

### Task 3: Provider adapter and HTTP contract

**Files:**
- Modify: `apps/api/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/api/src/auth/google-oauth.client.ts`
- Modify: `apps/api/src/auth/google-oauth.service.test.ts`
- Modify: `apps/api/src/auth/auth.controller.test.ts`
- Modify: `apps/api/src/auth/auth.controller.ts`
- Modify: `apps/api/src/auth/auth.module.ts`
- Modify: `apps/api/src/auth/tokens.ts`
- Modify: `apps/api/src/common/domain-exception.filter.ts`

- [ ] Add exact `google-auth-library@10.7.0`.
- [ ] Write failing adapter/controller tests for Google redirects, callback cookies, cancellation, invalid state, and non-sensitive errors.
- [ ] Implement the provider adapter, dependency injection, public routes, cookie issuance, and stable error mapping.
- [ ] Run auth tests, API lint, typecheck, and build.

### Task 4: Web experience and deployment configuration

**Files:**
- Create: `apps/web/components/google-sign-in.test.tsx`
- Create: `apps/web/components/google-sign-in.tsx`
- Modify: `apps/web/app/login/page.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `.env.example`
- Modify: `compose.prod.yaml`
- Modify: `docs/deployment.md`

- [ ] Write a failing component test for enabled/disabled visibility and callback-error messages.
- [ ] Implement the login button and safe error presentation.
- [ ] Add API/web environment examples and production Compose pass-through without secrets.
- [ ] Document Google console redirect setup and credential rotation.
- [ ] Run web tests, lint, typecheck, and production build.

### Task 5: Verification and tracking

**Files:**
- Modify: `docs/superpowers/plans/2026-06-21-courtlink-ph-implementation.md`
- Create: `docs/verification/2026-06-23-google-oauth.md`
- Modify: `PAUSE.md`

- [ ] Apply the migration and run `pnpm check`.
- [ ] Run all PostgreSQL integration groups with the documented local environment.
- [ ] Record exact automated results and the external live-provider verification gap.
- [ ] Mark Google OAuth complete only when code/configuration tests pass; keep live provider deployment evidence explicitly pending if credentials are unavailable.
- [ ] Update the pause checkpoint and remaining work before publication.
