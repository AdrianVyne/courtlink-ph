# Court Availability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make court operating hours, closures, existing bookings, Manila-local slot alignment, and prices authoritative for quotes, holds, and public availability.

**Architecture:** Pure schedule functions convert UTC intervals to Manila-local calendar values and evaluate windows/closures. Court repositories expose schedule data and perform closure/hold writes transactionally, while services own stable domain errors and slot generation. Nest controllers enforce tenant roles and Next.js renders only server-returned availability.

**Tech Stack:** TypeScript, NestJS, Prisma, PostgreSQL, Next.js, React, Vitest

---

### Task 1: Manila schedule policy

**Files:**
- Create: `apps/api/src/courts/availability-policy.test.ts`
- Create: `apps/api/src/courts/availability-policy.ts`
- Modify: `apps/api/src/courts/court.service.ts`

- [x] **Step 1: Write failing schedule-policy tests**

```ts
expect(manilaParts(new Date("2026-06-21T23:30:00.000Z"))).toEqual({
  date: "2026-06-22",
  dayOfWeek: 1,
  minuteOfDay: 450,
});
expect(validateScheduledInterval(court, mondayHours, [], start, end)).toEqual({ windowId: "hours-1" });
expect(() => validateScheduledInterval(court, mondayHours, [], misalignedStart, end)).toThrow(ScheduleError);
expect(() => validateScheduledInterval(court, mondayHours, [closure], start, end)).toThrow(ScheduleError);
```

- [x] **Step 2: Verify the tests fail because the policy is absent**

Run: `pnpm --filter @courtlink/api test -- src/courts/availability-policy.test.ts`
Expected: FAIL on missing `availability-policy.js`.

- [x] **Step 3: Implement pure Manila conversion and interval validation**

Define `OperatingWindow`, `ClosureWindow`, `ScheduleError`, `manilaParts`, `intervalsOverlap`, and `validateScheduledInterval`. Use fixed UTC+08:00, reject cross-day intervals, require containment in one weekday window, align starts relative to `opensMinute`, and check closure overlap.

- [x] **Step 4: Add candidate-slot generation tests and implementation**

```ts
expect(generateCandidateIntervals(court, mondayHours, "2026-06-22", 60)).toEqual([
  { startsAt: new Date("2026-06-22T00:00:00.000Z"), endsAt: new Date("2026-06-22T01:00:00.000Z") },
  { startsAt: new Date("2026-06-22T00:30:00.000Z"), endsAt: new Date("2026-06-22T01:30:00.000Z") },
]);
```

Parse the date strictly, convert Manila midnight to UTC by subtracting eight hours, and iterate each matching window at `slotIncrementMin` while the requested duration fits.

- [x] **Step 5: Run policy tests and API typecheck**

Run: `pnpm --filter @courtlink/api test -- src/courts/availability-policy.test.ts && pnpm --filter @courtlink/api typecheck`
Expected: all policy tests pass and TypeScript exits zero.

- [x] **Step 6: Commit the policy slice**

```bash
git add apps/api/src/courts/availability-policy.ts apps/api/src/courts/availability-policy.test.ts apps/api/src/courts/court.service.ts
git commit -m "feat: add Manila court schedule policy"
```

### Task 2: Schedule repository and transactional enforcement

**Files:**
- Modify: `apps/api/src/courts/court.service.ts`
- Modify: `apps/api/src/courts/prisma-court.repository.ts`
- Modify: `apps/api/src/courts/booking.service.ts`
- Modify: `apps/api/src/courts/prisma-booking.repository.ts`
- Modify: `apps/api/src/courts/booking.service.test.ts`
- Create: `apps/api/integration/court-availability-flow.test.ts`
- Modify: `packages/database/prisma/seed.ts`

- [x] **Step 1: Write failing service tests for schedule-aware quote and hold**

Extend the fake court repository with hours, closures, and blocking intervals. Assert `quote()` rejects closed/closure intervals and `createHold()` passes schedule validation before repository insertion.

- [x] **Step 2: Verify the booking-service tests fail**

Run: `pnpm --filter @courtlink/api test -- src/courts/booking.service.test.ts`
Expected: FAIL because quote/hold do not load schedule data.

- [x] **Step 3: Extend court repository contracts and Prisma reads**

Add `getSchedule(courtId)`, `replaceOperatingHours(courtId, windows)`, `createClosure(input)`, `deleteClosure(courtId, closureId)`, and `listBlockingBookings(courtId, startsAt, endsAt)`. Map all dates and numeric fields into framework-independent records.

- [x] **Step 4: Enforce schedule during quote and hold**

`BookingService.quote()` loads schedule and calls `validateScheduledInterval`. `PrismaBookingRepository.createHold()` repeats operating-hour and closure checks inside its existing transaction immediately before booking creation; map exclusion violations to `COURT_BOOKING_CONFLICT`.

- [x] **Step 5: Write failing PostgreSQL integration scenarios**

Create a court with Monday hours and a closure. Prove a hold inside hours succeeds, a hold in the closure fails, a closure overlapping an active booking fails, and two concurrent overlapping holds yield one success and one conflict.

- [x] **Step 6: Implement transactional closure conflict checks**

Inside `createClosure`, query blocking bookings with `startsAt < closureEnd AND endsAt > closureStart` and blocking statuses. Throw `CLOSURE_BOOKINGS_EXIST` before insert when any exists.

- [x] **Step 7: Seed explicit weekly operating hours**

Create deterministic `08:00-22:00` Manila windows for each demo court on all seven weekdays. Re-seeding must remain idempotent by replacing or upserting the windows.

- [x] **Step 8: Run unit and integration tests**

Run: `pnpm --filter @courtlink/api test -- src/courts`

Run: `$env:DATABASE_URL='postgresql://courtlink:courtlink@localhost:5433/courtlink'; pnpm --filter @courtlink/api test:integration -- integration/court-availability-flow.test.ts`
Expected: unit tests and all court-availability integration scenarios pass.

- [x] **Step 9: Commit transactional enforcement**

```bash
git add apps/api/src/courts apps/api/integration/court-availability-flow.test.ts packages/database/prisma/seed.ts
git commit -m "feat: enforce court schedules transactionally"
```

### Task 3: Tenant-authorized schedule API

**Files:**
- Create: `apps/api/src/courts/court-schedule.service.test.ts`
- Create: `apps/api/src/courts/court-schedule.service.ts`
- Modify: `apps/api/src/courts/court.controller.ts`
- Modify: `apps/api/src/courts/court.module.ts`
- Modify: `apps/api/src/common/domain-exception.filter.ts`
- Create: `apps/api/integration/court-schedule-authorization.test.ts`

- [x] **Step 1: Write failing schedule-service validation tests**

Test weekday/minute bounds, positive windows, duplicate starts, overlap rejection, closure range validation, and deletion ownership.

- [x] **Step 2: Verify the focused tests fail**

Run: `pnpm --filter @courtlink/api test -- src/courts/court-schedule.service.test.ts`
Expected: FAIL because schedule service does not exist.

- [x] **Step 3: Implement schedule service and stable errors**

The service validates and sorts replacement windows, delegates atomic repository writes, and maps repository conflicts to `CLOSURE_BOOKINGS_EXIST`. Add schedule error codes to the global HTTP map with 404/409 statuses where appropriate.

- [x] **Step 4: Add controller routes and tenant authorization**

Use Zod schemas for `PUT operating-hours`, `POST closures`, and `DELETE closures/:closureId`. Resolve court -> venue -> business and require `OWNER` or `MANAGER` before every management call. Keep `GET schedule` authenticated and tenant-scoped.

- [x] **Step 5: Prove cross-tenant denial with PostgreSQL integration**

Create two businesses and a manager for only one. Assert the manager cannot read, replace, create, or delete schedule data on the other business's court.

- [x] **Step 6: Run API tests and integration authorization**

Run: `pnpm --filter @courtlink/api test -- src/courts`

Run: `$env:DATABASE_URL='postgresql://courtlink:courtlink@localhost:5433/courtlink'; pnpm --filter @courtlink/api test:integration -- integration/court-schedule-authorization.test.ts`
Expected: all focused and authorization tests pass.

- [x] **Step 7: Commit schedule management API**

```bash
git add apps/api/src/courts apps/api/src/common/domain-exception.filter.ts apps/api/integration/court-schedule-authorization.test.ts
git commit -m "feat: add tenant-authorized court schedules"
```

### Task 4: Public priced slots and booking UI

**Files:**
- Create: `apps/api/src/courts/availability.service.test.ts`
- Create: `apps/api/src/courts/availability.service.ts`
- Modify: `apps/api/src/courts/court.controller.ts`
- Modify: `apps/api/src/courts/court.module.ts`
- Modify: `apps/web/lib/api.ts`
- Modify: `apps/web/components/court-booking.test.tsx`
- Modify: `apps/web/components/court-booking.tsx`

- [x] **Step 1: Write failing priced-slot service tests**

Generate candidates, remove closure and blocking-booking overlaps, omit candidates without pricing, and return UTC ISO ranges with PHP prices sorted ascending.

- [x] **Step 2: Verify service tests fail**

Run: `pnpm --filter @courtlink/api test -- src/courts/availability.service.test.ts`
Expected: FAIL because availability service does not exist.

- [x] **Step 3: Implement public availability service and endpoint**

Validate `date` and `durationMin`, load court/schedule/bookings/pricing once, generate candidates, filter overlaps, quote survivors, and return `{ startsAt, endsAt, totalAmount, currency }[]` from `GET :id/availability`.

- [x] **Step 4: Write a failing booking-component test**

Mock the API to return two server slots. Assert the UI renders those exact Manila times, creates a hold with the selected UTC timestamps, and never synthesizes an unreturned slot.

- [x] **Step 5: Implement server-slot selection in the booking component**

Replace free-form datetime inputs with date, duration, load-availability action, and selectable returned slots. Keep proof upload and hold lifecycle unchanged after selection.

- [x] **Step 6: Run API/web tests, typechecks, and web build**

Run: `pnpm --filter @courtlink/api test -- src/courts && pnpm --filter @courtlink/web test -- components/court-booking.test.tsx && pnpm --filter @courtlink/api typecheck && pnpm --filter @courtlink/web typecheck && pnpm --filter @courtlink/web build`
Expected: all tests/typechecks pass and production routes build.

- [x] **Step 7: Commit public availability**

```bash
git add apps/api/src/courts apps/web/lib/api.ts apps/web/components/court-booking.tsx apps/web/components/court-booking.test.tsx
git commit -m "feat: add priced court slot booking"
```

### Task 5: Venue schedule workspace and verification

**Files:**
- Create: `apps/web/components/court-schedule-manager.test.tsx`
- Create: `apps/web/components/court-schedule-manager.tsx`
- Modify: `apps/web/app/manage/page.tsx`
- Modify: `apps/web/lib/api.ts`
- Modify: `apps/web/app/globals.css`
- Modify: `docs/superpowers/plans/2026-06-21-courtlink-ph-implementation.md`
- Create: `docs/verification/2026-06-22-court-availability.md`

- [ ] **Step 1: Write a failing manager-component test**

Render a court schedule, edit Monday to `08:00-22:00`, submit normalized minute values, add a Manila-local closure converted to UTC, and assert no controls appear for a read-only role.

- [ ] **Step 2: Verify the component test fails**

Run: `pnpm --filter @courtlink/web test -- components/court-schedule-manager.test.tsx`
Expected: FAIL because the manager does not exist.

- [ ] **Step 3: Implement the manager and venue workspace wiring**

Load schedule data for each managed court on the server. Render weekday windows and upcoming closures, submit API mutations, and refresh on success. Display Manila-local values and stable API errors.

- [ ] **Step 4: Run the full quality and integration gates**

Run: `pnpm check`
Expected: all format, lint, typecheck, unit-test, and build tasks pass.

Run: `$env:DATABASE_URL='postgresql://courtlink:courtlink@localhost:5433/courtlink'; $env:REDIS_URL='redis://localhost:6379'; pnpm test:integration`
Expected: all task groups pass including schedule, closure, authorization, and overlap scenarios.

- [ ] **Step 5: Verify live HTTP behavior**

Seed the database, authenticate as venue owner, configure hours and a closure, confirm public slots omit the closure, confirm a closed slot quote/hold returns the stable error, and confirm a valid slot creates a hold.

- [ ] **Step 6: Update tracking and verification evidence**

Mark hours/closures and closure-aware availability complete in the main plan. Record exact commands, counts, and live HTTP results in the verification document without user/payment data.

- [ ] **Step 7: Commit the workspace and evidence**

```bash
git add apps/web docs/superpowers/plans/2026-06-21-courtlink-ph-implementation.md docs/verification/2026-06-22-court-availability.md
git commit -m "feat: complete court availability management"
```
