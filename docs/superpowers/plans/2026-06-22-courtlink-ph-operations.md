# CourtLink PH Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add privacy-safe observability, dependency readiness, capacity alerts, queue failure visibility, and operational runbooks for the free-tier production deployment.

**Architecture:** Small pure TypeScript policy modules define redaction, correlation IDs, thresholds, and queue retry settings. NestJS adapters gather PostgreSQL, Redis, process, and BullMQ data behind super-admin endpoints, while Fastify hooks emit correlated JSON request events. BullMQ's retained failed set is the initial dead-letter store and the admin web workspace displays sanitized status.

**Tech Stack:** TypeScript, NestJS, Fastify, Prisma, PostgreSQL, Redis, BullMQ, Next.js, Vitest, Docker Compose

---

### Task 1: Structured logging and correlation IDs

**Files:**
- Create: `apps/api/src/observability/redaction.test.ts`
- Create: `apps/api/src/observability/redaction.ts`
- Create: `apps/api/src/observability/correlation.test.ts`
- Create: `apps/api/src/observability/correlation.ts`
- Create: `apps/api/src/observability/structured-logger.ts`
- Modify: `apps/api/src/main.ts`
- Modify: `apps/api/src/common/domain-exception.filter.ts`

- [ ] **Step 1: Write failing redaction and correlation tests**

```ts
expect(redactLogValue({ cookie: "secret", nested: { transactionRef: "123", count: 2 } })).toEqual({
  cookie: "[REDACTED]",
  nested: { transactionRef: "[REDACTED]", count: 2 },
});
expect(resolveCorrelationId("not-a-uuid")).toMatch(UUID_PATTERN);
expect(resolveCorrelationId(knownUuid)).toBe(knownUuid);
```

- [ ] **Step 2: Verify the tests fail for missing modules**

Run: `pnpm --filter @courtlink/api test -- src/observability/redaction.test.ts src/observability/correlation.test.ts`
Expected: FAIL because the observability modules do not exist.

- [ ] **Step 3: Implement recursive key redaction and UUID correlation resolution**

```ts
export function resolveCorrelationId(value: unknown): string {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : randomUUID();
}

export function redactLogValue(value: unknown, key = ""): unknown {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (Array.isArray(value)) return value.map((item) => redactLogValue(item));
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactLogValue(v, k)]));
  return value;
}
```

- [ ] **Step 4: Add a JSON Nest logger and Fastify request hooks**

Register `onRequest` and `onResponse` hooks in `main.ts`. Store the resolved ID on the request, set `x-correlation-id`, and emit only method, pathname, status, duration, and correlation ID through `StructuredLogger`. Update `DomainExceptionFilter` to include the request correlation ID in internal error events without logging request data.

- [ ] **Step 5: Run focused tests and API typecheck**

Run: `pnpm --filter @courtlink/api test -- src/observability && pnpm --filter @courtlink/api typecheck`
Expected: all observability tests pass and TypeScript exits zero.

- [ ] **Step 6: Commit the logging slice**

```bash
git add apps/api/src/observability apps/api/src/main.ts apps/api/src/common/domain-exception.filter.ts
git commit -m "feat: add correlated structured API logs"
```

### Task 2: Dependency readiness and capacity policy

**Files:**
- Create: `apps/api/src/operations/capacity-policy.test.ts`
- Create: `apps/api/src/operations/capacity-policy.ts`
- Create: `apps/api/src/operations/operations.service.test.ts`
- Create: `apps/api/src/operations/operations.service.ts`
- Create: `apps/api/src/operations/prisma-operations.probe.ts`
- Create: `apps/api/src/operations/operations.module.ts`
- Modify: `apps/api/src/health/health.controller.ts`
- Modify: `apps/api/src/health/health.controller.test.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/package.json`

- [ ] **Step 1: Write failing threshold and readiness tests**

```ts
expect(classifyRatio(0.69)).toBe("ok");
expect(classifyRatio(0.7)).toBe("warning");
expect(classifyRatio(0.85)).toBe("critical");
await expect(service.readiness()).resolves.toEqual({ status: "ready" });
await expect(failingService.readiness()).rejects.toMatchObject({ status: 503 });
```

- [ ] **Step 2: Verify the focused tests fail**

Run: `pnpm --filter @courtlink/api test -- src/operations src/health/health.controller.test.ts`
Expected: FAIL because capacity policy and readiness dependencies are absent.

- [ ] **Step 3: Implement capacity classification and snapshot types**

Define stable `ok | warning | critical` levels, alert codes, configurable database byte budget, process heap ratio, event-loop delay, Redis memory ratio, and queue failed-count rules. Pure functions must accept raw numbers and return deterministic snapshots.

- [ ] **Step 4: Implement PostgreSQL, Redis, process, and BullMQ probes**

Use Prisma `$queryRaw` for `SELECT 1` and `pg_database_size(current_database())`, Redis `PING` and `INFO memory`, Node process memory, and BullMQ `Queue.getJobCounts()`. Apply a two-second timeout to readiness probes and close Redis/queue clients during Nest shutdown.

- [ ] **Step 5: Split liveness from readiness**

Expose `GET /api/v1/health/live` as a static public process check. Make `GET /api/v1/health/ready` call `OperationsService.readiness()` and throw `ServiceUnavailableException` without exposing dependency details when a probe fails.

- [ ] **Step 6: Run focused tests and typecheck**

Run: `pnpm --filter @courtlink/api test -- src/operations src/health && pnpm --filter @courtlink/api typecheck`
Expected: focused tests pass and TypeScript exits zero.

- [ ] **Step 7: Commit the readiness slice**

```bash
git add apps/api/package.json pnpm-lock.yaml apps/api/src/operations apps/api/src/health apps/api/src/app.module.ts
git commit -m "feat: add dependency readiness and capacity probes"
```

### Task 3: Queue retries and dead-letter visibility

**Files:**
- Create: `apps/worker/src/queue-policy.test.ts`
- Create: `apps/worker/src/queue-policy.ts`
- Modify: `apps/worker/src/hold-expiry.ts`
- Modify: `apps/worker/src/review-escalation.ts`
- Modify: `apps/worker/src/booking-completion.ts`
- Modify: `apps/worker/src/main.ts`
- Modify: `apps/api/src/operations/prisma-operations.probe.ts`

- [ ] **Step 1: Write a failing queue-policy test**

```ts
expect(SCHEDULED_JOB_OPTIONS).toMatchObject({ attempts: 3, backoff: { type: "exponential", delay: 5000 } });
expect(sanitizeFailedJob(job)).toEqual({
  id: "42",
  name: "hold-expiry",
  attemptsMade: 3,
  failedAt: "2026-06-22T00:00:00.000Z",
  error: "database unavailable",
});
```

- [ ] **Step 2: Verify the test fails**

Run: `pnpm --filter @courtlink/worker test -- src/queue-policy.test.ts`
Expected: FAIL because queue policy does not exist.

- [ ] **Step 3: Implement and apply retry retention policy**

```ts
export const SCHEDULED_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 5_000 },
  removeOnComplete: 50,
  removeOnFail: false,
};
```

Apply the options to all three job schedulers. Log `attemptsMade` on failures and label exhausted jobs `dead-letter.retained`; never log job data.

- [ ] **Step 4: Expose sanitized failed jobs through the operations probe**

For each queue, fetch at most five newest failed jobs and map only queue, ID, name, attempts, failed timestamp, and a 200-character sanitized reason. Do not return `job.data`, stack traces, or Redis keys.

- [ ] **Step 5: Run worker and operations tests**

Run: `pnpm --filter @courtlink/worker test && pnpm --filter @courtlink/api test -- src/operations`
Expected: all worker and operations tests pass.

- [ ] **Step 6: Commit queue reliability**

```bash
git add apps/worker/src apps/api/src/operations
git commit -m "feat: retain and expose failed background jobs"
```

### Task 4: Super-admin operational status

**Files:**
- Create: `apps/api/src/operations/operations.controller.test.ts`
- Create: `apps/api/src/operations/operations.controller.ts`
- Create: `apps/web/app/admin/operations/page.tsx`
- Create: `apps/web/components/operations-status.tsx`
- Modify: `apps/web/app/admin/page.tsx`
- Modify: `apps/web/lib/api.ts`
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Write failing authorization tests**

```ts
await expect(controller.status(playerRequest)).rejects.toMatchObject({ status: 403 });
await expect(controller.status(superAdminRequest)).resolves.toMatchObject({ overall: "ok" });
```

- [ ] **Step 2: Verify the controller test fails**

Run: `pnpm --filter @courtlink/api test -- src/operations/operations.controller.test.ts`
Expected: FAIL because the controller does not exist.

- [ ] **Step 3: Add super-admin-only status and metrics endpoints**

`GET /api/v1/operations/status` returns the typed snapshot. `GET /api/v1/operations/metrics` returns aggregate metric names and numeric values as JSON. Both require `SUPER_ADMIN`; neither is decorated `@Public()`.

- [ ] **Step 4: Add the admin operations page**

Render overall state, active alerts, dependency state, process/database/Redis capacity, queue counts, and sanitized failed jobs. Reuse existing status-pill and dashboard styles, provide no destructive controls, and link the page from `/admin`.

- [ ] **Step 5: Run API tests, web typecheck, and web build**

Run: `pnpm --filter @courtlink/api test -- src/operations && pnpm --filter @courtlink/web typecheck && pnpm --filter @courtlink/web build`
Expected: tests pass, generated route types include `/admin/operations`, and the production build exits zero.

- [ ] **Step 6: Commit operational status**

```bash
git add apps/api/src/operations apps/web/app/admin apps/web/components/operations-status.tsx apps/web/lib/api.ts apps/web/app/globals.css
git commit -m "feat: add super-admin operations status"
```

### Task 5: Deployment alerts and recovery runbooks

**Files:**
- Create: `docs/runbooks/operations.md`
- Create: `docs/runbooks/queue-recovery.md`
- Create: `docs/runbooks/restore-drill.md`
- Create: `docs/adr/0003-built-in-observability.md`
- Modify: `.env.example`
- Modify: `compose.prod.yaml`
- Modify: `docs/deployment.md`
- Modify: `docs/superpowers/plans/2026-06-21-courtlink-ph-implementation.md`

- [ ] **Step 1: Document thresholds and non-secret environment settings**

Add `DATABASE_CAPACITY_BYTES`, heap/event-loop thresholds, and readiness timeout defaults to `.env.example` and pass them to the API in production Compose.

- [ ] **Step 2: Add alert and incident runbooks**

Document readiness probing, super-admin status inspection, Docker log filtering by correlation ID, disk/database/Redis remediation, queue failed-job inspection and retry commands, escalation contacts, and post-incident recording. Commands must avoid printing environment secrets.

- [ ] **Step 3: Add the monthly restore drill runbook**

Specify scratch-database creation, latest encrypted backup restore, schema and representative row-count checks, teardown, evidence recording, and failure escalation. Keep production restore as a separately authorized action.

- [ ] **Step 4: Record the architecture decision and update plan status**

ADR 0003 records local JSON telemetry plus BullMQ failed sets instead of a paid monitoring stack. Mark Task 9 observability complete only after all tests and live probes pass; retain deployment-verification items until exercised.

- [ ] **Step 5: Run formatting and documentation checks**

Run: `pnpm format && git diff --check && rg -n "TBD|TODO" docs/runbooks docs/adr/0003-built-in-observability.md`
Expected: formatting succeeds, diff check is clean, and placeholder search returns no matches.

- [ ] **Step 6: Commit operations documentation**

```bash
git add .env.example compose.prod.yaml docs
git commit -m "docs: add operations and recovery runbooks"
```

### Task 6: Operational integration and release gate

**Files:**
- Create: `apps/api/integration/operations-flow.test.ts`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Write a live dependency integration test**

Build the production probe with test PostgreSQL and Redis URLs, assert readiness succeeds, assert queue names and counts are present, and close every created client in `afterAll`.

- [ ] **Step 2: Verify the integration test fails before adapter wiring is complete**

Run: `$env:DATABASE_URL='postgresql://courtlink:courtlink@localhost:5433/courtlink'; $env:REDIS_URL='redis://localhost:6379'; pnpm --filter @courtlink/api test:integration -- integration/operations-flow.test.ts`
Expected: FAIL until the production operations probe can connect and report status.

- [ ] **Step 3: Complete integration wiring and CI services**

Ensure CI supplies both URLs, runs the operations integration test, and closes handles cleanly. Do not add external SaaS credentials.

- [ ] **Step 4: Run full verification**

Run: `pnpm check`
Expected: format, lint, all typechecks, unit tests, and production builds pass.

Run: `$env:DATABASE_URL='postgresql://courtlink:courtlink@localhost:5433/courtlink'; $env:REDIS_URL='redis://localhost:6379'; pnpm test:integration`
Expected: all database, API, worker, web, domain, and backup integration tasks pass.

- [ ] **Step 5: Verify production health and status**

Build and start production Compose, confirm `/api/v1/health/live` and `/api/v1/health/ready` return 200, authenticate as the seeded super admin, and confirm `/api/v1/operations/status` contains dependency and queue snapshots without secrets or personal data.

- [ ] **Step 6: Commit release verification updates**

```bash
git add apps/api/integration/operations-flow.test.ts .github/workflows/ci.yml docs/superpowers/plans/2026-06-21-courtlink-ph-implementation.md
git commit -m "test: verify production operations flow"
```
