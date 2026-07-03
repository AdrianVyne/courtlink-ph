# Test Coverage Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close two regression-coverage gaps identified in the design spec — CI silently skips several e2e tests because it never boots the API, and 20 interactive web components have zero test coverage above the API layer.

**Architecture:** Fix the CI foundation first (boot + seed a real API in the `verify` job) so every "needs seeded API" test — existing and new — actually executes instead of skipping. Then add seven new Playwright e2e specs for the highest-blast-radius untested flows (Tier 1), reusing the existing `loginAs`/fixture-cleanup conventions in `apps/web/e2e/helpers.ts`. Then split the e2e CI step into a 3-leg matrix to keep wall-clock time flat. Finally add five RTL unit tests for the remaining logic-bearing untested components (Tier 2).

**Tech Stack:** Playwright + `@axe-core/playwright` (e2e), Vitest + `@testing-library/react` (unit), GitHub Actions (CI), Prisma seed script.

## Global Constraints

- Demo password for all seeded accounts: `courtlink-demo-2026` (from `packages/database/prisma/seed.ts`).
- API base path: all HTTP calls go through `/api/v1` (see `apiFetch` in `apps/web/lib/api.ts:378`).
- e2e specs that need a live API must guard with `test.skip(!response || !response.ok(), "API is not running")`, matching the existing convention in `apps/web/e2e/public-pages.spec.ts` and `venue-photos.spec.ts`.
- Every new e2e spec must pass `pnpm exec biome check` (existing lint/format config) and be added to the CI matrix in Task 11.
- Test-created venues use an `e2e-<flow>-<8hex>` slug prefix (matches existing `mod-`, `promo-`, `vtest-` conventions in `apps/api/integration/*.test.ts`) so they're identifiable; they are not deleted (no delete-venue endpoint exists) but are wiped automatically in CI because Postgres is a fresh ephemeral service container per run. Locally they accumulate across repeated runs — acceptable, same trade-off the API integration tests don't have (those use direct Prisma access to clean up; e2e specs only have HTTP access).
- `window.prompt`-based confirmation dialogs (`report-button.tsx`, `moderation-queue.tsx`, `venue-queue.tsx`) require registering `page.once("dialog", ...)` **before** the triggering click, or Playwright auto-dismisses the dialog and the action silently no-ops.

---

### Task 1: CI foundation — boot and seed a real API for e2e

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: a running API reachable at `http://localhost:3001/api/v1/*` inside the `verify` job, with the demo seed loaded, before the `pnpm --filter @courtlink/web test:e2e` step runs.

This task makes the currently-skipping specs (`venue detail renders and passes axe`, `coach detail renders and passes axe`, `player dashboard renders and passes axe`, all of `venue-photos.spec.ts`) execute for real in CI. There is no code to test-first here (it's CI infrastructure) — the acceptance check is the CI log itself.

- [ ] **Step 1: Add a MinIO container step to the `verify` job.** GitHub Actions `services:` does not support a custom `command:` override, and the `minio/minio` image requires one (`server /data`) to start — this is why we run it as a plain `docker run` step instead of a `services:` entry, matching `compose.yaml`'s image and command exactly.

  Open `.github/workflows/ci.yml` and insert this step immediately after the `actions/checkout@v7` step (before `pnpm/action-setup@v6`):

  ```yaml
      - name: Start MinIO
        run: |
          docker run -d --name minio -p 9000:9000 \
            -e MINIO_ROOT_USER=courtlink \
            -e MINIO_ROOT_PASSWORD=courtlink-dev-secret \
            minio/minio:RELEASE.2025-04-22T22-12-26Z server /data
          for i in $(seq 1 20); do
            curl -sf http://localhost:9000/minio/health/live && break
            sleep 1
          done
  ```

- [ ] **Step 2: Seed the database after migration.** Find this existing line:

  ```yaml
        - run: pnpm --filter @courtlink/database db:migrate
  ```

  Add immediately after it:

  ```yaml
        - run: pnpm --filter @courtlink/database db:seed
  ```

- [ ] **Step 3: Build and start the API in the background, then wait for it to be healthy.** Insert this step after the seed step and before `- run: pnpm check`:

  ```yaml
        - name: Start API
          env:
            DATABASE_URL: postgresql://courtlink:courtlink@localhost:5432/courtlink?schema=public
            REDIS_URL: redis://localhost:6379
            SESSION_SECRET: ci-session-secret-32-characters-min
            ENCRYPTION_KEY: Y2ktZW5jcnlwdGlvbi1rZXktMzItYnl0ZXMtbG9uZyEh
            OBJECT_STORAGE_ENDPOINT: http://localhost:9000
            OBJECT_STORAGE_BUCKET: courtlink-ci
            OBJECT_STORAGE_ACCESS_KEY: courtlink
            OBJECT_STORAGE_SECRET_KEY: courtlink-dev-secret
          run: |
            pnpm --filter @courtlink/api build
            pnpm --filter @courtlink/api start &
            for i in $(seq 1 30); do
              curl -sf http://localhost:3001/api/v1/health/live && break
              sleep 1
            done
  ```

  (`ENCRYPTION_KEY` above is a 32-byte value base64-encoded — matches the format `packages/database`'s encryption helpers expect, same shape used locally this session.)

- [ ] **Step 4: Point the web app's API proxy at the running API.** The `pnpm --filter @courtlink/web test:e2e` step needs `API_PROXY_TARGET` set so `apps/web/next.config.ts`'s rewrite resolves to the API we just started (default is already `http://localhost:3001`, so this step only needs to exist if a later change moves the port — add it explicitly for clarity and to avoid relying on the default):

  Change:
  ```yaml
        - run: pnpm --filter @courtlink/web test:e2e
  ```
  to:
  ```yaml
        - name: Run e2e
          env:
            API_PROXY_TARGET: http://localhost:3001
          run: pnpm --filter @courtlink/web test:e2e
  ```

- [ ] **Step 5: Push to a branch and confirm in the Actions log that previously-skipping specs now pass.** This step has no local equivalent — the CI job itself is the test.

  ```bash
  git add .github/workflows/ci.yml
  git commit -m "ci: boot and seed a real API so e2e specs that need it actually run"
  git push
  ```

  Open the `verify` job's log for the pushed commit and confirm the Playwright output shows lines like:
  ```
  ✓  detail pages (need a seeded API) › venue detail renders and passes axe
  ✓  detail pages (need a seeded API) › coach detail renders and passes axe
  ✓  dashboard (needs seeded API) › player dashboard renders and passes axe
  ✓  venue photos (needs seeded API) › owner upload appears as the cover photo on court discovery
  ```
  rather than `-` (skipped). If any show `-`, the API bootstrap failed — check the "Start API" step's log for the health-check loop timing out.

- [ ] **Step 6: Update `PAUSE.md`** with a one-line note that CI now boots a real API for e2e (so a future session doesn't re-discover this from scratch). Commit separately if `PAUSE.md` wasn't already staged:
  ```bash
  git add PAUSE.md
  git commit -m "docs: note CI now boots a seeded API for e2e"
  ```

---

### Task 2: Extend the demo seed with a completed, unreviewed booking

**Files:**
- Modify: `packages/database/prisma/seed.ts`

**Interfaces:**
- Produces: a `CourtBooking` row with `status: "COMPLETED"`, `playerId` = the seeded `player@demo.courtlink.ph` user, `courtId` = the seeded "Court 1", not yet reviewed. Consumed by Task 8 (`reviews.spec.ts`).

The demo seed currently has no bookings at all. A `COMPLETED` booking can only be reached via the real booking flow by waiting for `apps/worker/src/booking-completion.ts` to run after the booking's end time passes — impractical inside a test. Every other flow needed by the new specs (moderation, venue approval, promotions, amenities, favorites) can be created live through the HTTP API inside the spec itself, so only this one needs a seed change.

- [ ] **Step 1: Add the booking to `main()` in `packages/database/prisma/seed.ts`.** Insert this block right before the `process.stdout.write(...)` call at the end of `main()` (after the `coachProfile.upsert` call):

  ```typescript
    const reviewableBooking = await prisma.courtBooking.findFirst({
      where: { courtId: court.id, status: "COMPLETED", playerId: (await prisma.user.findUniqueOrThrow({ where: { email: "player@demo.courtlink.ph" } })).id },
    });
    if (!reviewableBooking) {
      const demoPlayer = await prisma.user.findUniqueOrThrow({
        where: { email: "player@demo.courtlink.ph" },
      });
      await prisma.courtBooking.create({
        data: {
          courtId: court.id,
          playerId: demoPlayer.id,
          status: "COMPLETED",
          startsAt: new Date("2026-06-01T02:00:00.000Z"),
          endsAt: new Date("2026-06-01T03:00:00.000Z"),
          quotedAmount: "250.00",
          proofDeadline: new Date("2026-06-01T00:00:00.000Z"),
        },
      });
    }
  ```

  This mirrors the exact shape used in `apps/api/integration/review-flow.test.ts`'s `completedBooking()` helper (lines 62-73), which is the proven way to construct a reviewable `COMPLETED` booking directly.

- [ ] **Step 2: Run the seed locally and verify the booking exists.**

  ```bash
  cd packages/database
  DATABASE_URL=postgresql://courtlink:courtlink@localhost:5433/courtlink pnpm db:seed
  ```

  Then verify with a one-off query:
  ```bash
  DATABASE_URL=postgresql://courtlink:courtlink@localhost:5433/courtlink node -e "
  const { PrismaClient } = require('@courtlink/database');
  const p = new PrismaClient();
  p.courtBooking.findMany({ where: { status: 'COMPLETED' } }).then((rows) => {
    console.log(rows.length, 'completed booking(s)');
    process.exit(rows.length > 0 ? 0 : 1);
  });
  "
  ```
  Expected: `1 completed booking(s)`.

- [ ] **Step 3: Re-run the seed a second time and confirm it stays idempotent (no duplicate booking created).**

  ```bash
  DATABASE_URL=postgresql://courtlink:courtlink@localhost:5433/courtlink pnpm db:seed
  DATABASE_URL=postgresql://courtlink:courtlink@localhost:5433/courtlink node -e "
  const { PrismaClient } = require('@courtlink/database');
  const p = new PrismaClient();
  p.courtBooking.count({ where: { status: 'COMPLETED' } }).then((n) => {
    console.log(n, 'completed booking(s) after second seed run');
    process.exit(n === 1 ? 0 : 1);
  });
  "
  ```
  Expected: `1 completed booking(s) after second seed run` (the `findFirst` guard in Step 1 prevents a duplicate).

- [ ] **Step 4: Commit.**
  ```bash
  cd /path/to/repo/root
  git add packages/database/prisma/seed.ts
  git commit -m "feat(seed): add a completed unreviewed booking for the demo player"
  ```

---

### Task 3: Extend `e2e/helpers.ts` with dialog and fixture helpers

**Files:**
- Modify: `apps/web/e2e/helpers.ts`

**Interfaces:**
- Produces:
  - `acceptNextPrompt(page: Page, response: string): void` — registers a one-time `window.prompt` auto-accept before a click that triggers one.
  - `getOwnerBusinessId(page: Page): Promise<string>` — returns the `businessId` of the first business membership for the currently logged-in session on `page`.
  - `createDraftVenue(page: Page, overrides: Partial<{ name: string; slug: string }>): Promise<{ id: string; slug: string; name: string }>` — creates a `DRAFT` venue owned by the current session's business.
- Consumes: nothing new — builds on the existing `loginAs` pattern already in this file.

- [ ] **Step 1: Add the three helpers to `apps/web/e2e/helpers.ts`.** Insert after the existing `uploadE2EVenueCoverPhoto` function (end of file):

  ```typescript
  /**
   * Registers a one-time auto-accept for the next `window.prompt` the page
   * triggers. Must be called BEFORE the click that opens the prompt —
   * Playwright auto-dismisses dialogs with no listener, which makes
   * prompt-gated actions (report, moderation resolve/dismiss, venue-queue
   * reject) silently no-op.
   */
  export function acceptNextPrompt(page: Page, response: string): void {
    page.once("dialog", (dialog) => {
      void dialog.accept(response);
    });
  }

  interface BusinessMembership {
    businessId: string;
  }

  export async function getOwnerBusinessId(page: Page): Promise<string> {
    const response = await page.context().request.get("/api/v1/businesses/mine");
    const memberships = (await response.json()) as BusinessMembership[];
    const membership = memberships[0];
    if (!membership) throw new Error("Session has no business membership");
    return membership.businessId;
  }

  interface CreatedVenue {
    id: string;
    slug: string;
    name: string;
  }

  export async function createDraftVenue(
    page: Page,
    overrides: Partial<{ name: string; slug: string }> = {},
  ): Promise<CreatedVenue> {
    const businessId = await getOwnerBusinessId(page);
    const slug = overrides.slug ?? `e2e-venue-${randomUUID().slice(0, 8)}`;
    const name = overrides.name ?? `E2E Test Venue ${slug.slice(-8)}`;
    const response = await page.context().request.post("/api/v1/venues", {
      data: {
        businessId,
        name,
        slug,
        regionCode: "NCR",
        cityMunicipality: "Manila",
        streetAddress: "1 E2E Test St",
      },
    });
    expect(response.ok(), await response.text()).toBe(true);
    return (await response.json()) as CreatedVenue;
  }
  ```

- [ ] **Step 2: Run the existing e2e suite to confirm the file still compiles and nothing broke.**
  ```bash
  cd apps/web
  pnpm exec tsc --noEmit -p e2e/tsconfig.json 2>/dev/null || pnpm typecheck
  ```
  Expected: no new type errors from `helpers.ts`. (If there's no dedicated e2e tsconfig, `pnpm typecheck` at the `apps/web` level covers it since `e2e/` is included in the project.)

- [ ] **Step 3: Commit.**
  ```bash
  git add apps/web/e2e/helpers.ts
  git commit -m "test(web): add dialog-accept and venue-fixture e2e helpers"
  ```

---

### Task 4: `favorites.spec.ts`

**Files:**
- Create: `apps/web/e2e/favorites.spec.ts`

**Interfaces:**
- Consumes: `loginAs` from `./helpers`.

- [ ] **Step 1: Write the spec.**

  ```typescript
  import { expect, test } from "@playwright/test";
  import { loginAs } from "./helpers";

  test.describe("favorites (needs seeded API)", () => {
    test("toggling a favorite persists across reload", async ({ page }) => {
      const loggedIn = await loginAs(page, "player@demo.courtlink.ph");
      test.skip(!loggedIn, "API not running or demo player seed missing");

      await page.goto("/courts/riverside-pickleball-demo");
      const toggle = page.getByRole("button", { name: /favorites/i });
      await expect(toggle).toBeVisible();

      // Start from a known state: unfavorite if already favorited from a prior run.
      if ((await toggle.getAttribute("aria-pressed")) === "true") {
        await toggle.click();
        await expect(toggle).toHaveAttribute("aria-pressed", "false");
      }

      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
      await expect(toggle).toHaveText(/Saved/);

      await page.reload();
      const toggleAfterReload = page.getByRole("button", { name: /favorites/i });
      await expect(toggleAfterReload).toHaveAttribute("aria-pressed", "true");

      // Clean up: unfavorite so repeated local runs start from the same state.
      await toggleAfterReload.click();
      await expect(toggleAfterReload).toHaveAttribute("aria-pressed", "false");
    });
  });
  ```

- [ ] **Step 2: Run it against the local API (must be up and seeded — see `apps/web/e2e/README.md`).**
  ```bash
  cd apps/web
  pnpm exec playwright test e2e/favorites.spec.ts
  ```
  Expected: `1 passed`.

- [ ] **Step 3: Run `pnpm exec biome check e2e/favorites.spec.ts` and fix any formatting/lint issues it reports.**

- [ ] **Step 4: Commit.**
  ```bash
  git add apps/web/e2e/favorites.spec.ts
  git commit -m "test(web): e2e coverage for the favorite-toggle button"
  ```

---

### Task 5: `registration.spec.ts`

**Files:**
- Create: `apps/web/e2e/registration.spec.ts`

**Interfaces:**
- Consumes: nothing from `helpers.ts` (self-contained — creates its own unique account).

This closes an existing gap: `public-pages.spec.ts` only asserts "register page loads," never that submitting it works.

- [ ] **Step 1: Write the spec.**

  ```typescript
  import { randomUUID } from "node:crypto";
  import { expect, test } from "@playwright/test";

  test.describe("registration (needs API)", () => {
    test("submitting the register form creates an account and reaches the dashboard", async ({
      page,
    }) => {
      const probe = await page.request.get("/api/v1/stats/public").catch(() => null);
      test.skip(!probe || !probe.ok(), "API is not running");

      const email = `e2e-register-${randomUUID().slice(0, 8)}@example.test`;

      await page.goto("/register");
      await page.getByLabel("Full name").fill("E2E Test Player");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill("e2e-registration-password-2026");
      await page.getByRole("button", { name: "Create account" }).click();

      await page.waitForURL("**/dashboard", { timeout: 15000 });
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  });
  ```

- [ ] **Step 2: Run it.**
  ```bash
  pnpm exec playwright test e2e/registration.spec.ts
  ```
  Expected: `1 passed`.

- [ ] **Step 3: Run `pnpm exec biome check e2e/registration.spec.ts` and fix any issues.**

- [ ] **Step 4: Commit.**
  ```bash
  git add apps/web/e2e/registration.spec.ts
  git commit -m "test(web): e2e coverage for account registration"
  ```

---

### Task 6: `amenities.spec.ts`

**Files:**
- Create: `apps/web/e2e/amenities.spec.ts`

**Interfaces:**
- Consumes: `loginAs` from `./helpers`.

- [ ] **Step 1: Write the spec.** The test picks whichever amenity checkbox is currently unchecked rather than hardcoding a catalog entry name, so it doesn't depend on the exact amenity catalog contents.

  ```typescript
  import { expect, test } from "@playwright/test";
  import { loginAs } from "./helpers";

  test.describe("venue amenities (needs seeded API)", () => {
    test("owner saves an amenity and it persists after reload", async ({ page }) => {
      const loggedIn = await loginAs(page, "owner@demo.courtlink.ph");
      test.skip(!loggedIn, "API not running or demo owner seed missing");

      await page.goto("/manage");
      const amenitiesSection = page.locator("section", { has: page.getByText("Amenities") });
      const unchecked = amenitiesSection.locator('input[name="amenities"]:not(:checked)').first();
      await expect(unchecked).toBeAttached();
      const label = unchecked.locator("xpath=ancestor::label[1]");
      const labelText = (await label.textContent())?.trim();

      await unchecked.check();
      await amenitiesSection.getByRole("button", { name: "Save amenities" }).click();
      await expect(amenitiesSection.getByText("Saved")).toBeVisible();

      await page.reload();
      const afterReload = page
        .locator("section", { has: page.getByText("Amenities") })
        .locator("label", { hasText: labelText ?? "" })
        .locator('input[name="amenities"]');
      await expect(afterReload).toBeChecked();
    });
  });
  ```

- [ ] **Step 2: Run it.**
  ```bash
  pnpm exec playwright test e2e/amenities.spec.ts
  ```
  Expected: `1 passed`. If it fails with "no unchecked amenity found," the demo venue already has every catalog amenity selected — uncheck one in the seed data or adjust the test to toggle a checked one off instead; note which in the commit if this happens.

- [ ] **Step 3: Run `pnpm exec biome check e2e/amenities.spec.ts` and fix any issues.**

- [ ] **Step 4: Commit.**
  ```bash
  git add apps/web/e2e/amenities.spec.ts
  git commit -m "test(web): e2e coverage for saving venue amenities"
  ```

---

### Task 7: `promotions.spec.ts`

**Files:**
- Create: `apps/web/e2e/promotions.spec.ts`

**Interfaces:**
- Consumes: `loginAs` from `./helpers`.

- [ ] **Step 1: Write the spec.**

  ```typescript
  import { expect, test } from "@playwright/test";
  import { loginAs } from "./helpers";

  test.describe("promotions (needs seeded API)", () => {
    test("owner creates a promotion and deactivates it", async ({ page }) => {
      const loggedIn = await loginAs(page, "owner@demo.courtlink.ph");
      test.skip(!loggedIn, "API not running or demo owner seed missing");

      const title = `E2E Promo ${Date.now()}`;
      await page.goto("/manage");
      const promotionsSection = page.locator("div", { has: page.getByText("Promotions") }).last();

      await promotionsSection.getByLabel("Title").fill(title);
      await promotionsSection.getByLabel("Value").fill("15");
      await promotionsSection.getByLabel("Starts").fill("2026-01-01T00:00");
      await promotionsSection.getByLabel("Ends").fill("2030-01-01T00:00");
      await promotionsSection.getByRole("button", { name: "Add promotion" }).click();

      const entry = page.locator("li", { hasText: title });
      await expect(entry).toBeVisible();
      await expect(entry.getByText("Active")).toBeVisible();

      await entry.getByRole("button", { name: "Deactivate" }).click();
      await expect(entry.getByText("Inactive")).toBeVisible();
    });
  });
  ```

- [ ] **Step 2: Run it.**
  ```bash
  pnpm exec playwright test e2e/promotions.spec.ts
  ```
  Expected: `1 passed`.

- [ ] **Step 3: Run `pnpm exec biome check e2e/promotions.spec.ts` and fix any issues.**

- [ ] **Step 4: Commit.**
  ```bash
  git add apps/web/e2e/promotions.spec.ts
  git commit -m "test(web): e2e coverage for creating and deactivating promotions"
  ```

---

### Task 8: `reviews.spec.ts`

**Files:**
- Create: `apps/web/e2e/reviews.spec.ts`

**Interfaces:**
- Consumes: `loginAs` from `./helpers`; the seeded `COMPLETED` booking from Task 2.

Because the seeded booking can only be reviewed once (the API rejects a second review for the same booking with `REVIEW_ALREADY_EXISTS`, and the `ReviewForm` stops rendering once `reviewed` is true), this spec is **not repeatable against the same persistent database** — it works once per fresh seed. This matches how CI runs (fresh DB every job) but means re-running it locally requires re-seeding first. The spec documents this in a comment.

- [ ] **Step 1: Write the spec.**

  ```typescript
  import { expect, test } from "@playwright/test";
  import { loginAs } from "./helpers";

  /**
   * Consumes the single seeded COMPLETED booking (packages/database/prisma/seed.ts).
   * Not repeatable against the same database without re-seeding: once submitted,
   * the booking is marked reviewed and the form no longer renders for it.
   */
  test.describe("reviews (needs seeded API, single-use fixture)", () => {
    test("player reviews a completed booking and the venue rating updates", async ({
      page,
      request,
    }) => {
      const loggedIn = await loginAs(page, "player@demo.courtlink.ph");
      test.skip(!loggedIn, "API not running or demo player seed missing");

      const venuesResponse = await request.get("/api/v1/venues").catch(() => null);
      test.skip(!venuesResponse || !venuesResponse.ok(), "API is not running");
      const venues = (await venuesResponse?.json()) as Array<{ id: string; slug: string }>;
      const venue = venues.find((v) => v.slug === "riverside-pickleball-demo");
      test.skip(!venue, "demo venue is not seeded");

      const before = await request.get(`/api/v1/reviews/venues/${venue?.id}`);
      const beforeCount = (await before.json()).rating.count as number;

      await page.goto("/dashboard");
      const reviewForm = page.locator("form", { has: page.getByRole("button", { name: "Submit review" }) });
      test.skip((await reviewForm.count()) === 0, "no unreviewed completed booking — already used or not seeded");

      await reviewForm.getByLabel("Comment (optional)").fill("E2E automated review");
      await reviewForm.getByRole("button", { name: "Submit review" }).click();
      await expect(page.getByText("Thanks for your review.")).toBeVisible();

      const after = await request.get(`/api/v1/reviews/venues/${venue?.id}`);
      const afterJson = await after.json();
      expect(afterJson.rating.count).toBe(beforeCount + 1);
      expect(
        (afterJson.items as Array<{ comment: string | null }>).some(
          (item) => item.comment === "E2E automated review",
        ),
      ).toBe(true);
    });
  });
  ```

- [ ] **Step 2: Ensure the seed has run (Task 2) so the fixture booking exists, then run the spec.**
  ```bash
  DATABASE_URL=postgresql://courtlink:courtlink@localhost:5433/courtlink pnpm --filter @courtlink/database db:seed
  cd apps/web
  pnpm exec playwright test e2e/reviews.spec.ts
  ```
  Expected: `1 passed`.

- [ ] **Step 3: Re-run it a second time without reseeding and confirm it skips cleanly rather than failing.**
  ```bash
  pnpm exec playwright test e2e/reviews.spec.ts
  ```
  Expected: `1 skipped` with reason `no unreviewed completed booking...`.

- [ ] **Step 4: Run `pnpm exec biome check e2e/reviews.spec.ts` and fix any issues.**

- [ ] **Step 5: Commit.**
  ```bash
  git add apps/web/e2e/reviews.spec.ts
  git commit -m "test(web): e2e coverage for submitting a booking review"
  ```

---

### Task 9: `venue-approval.spec.ts`

**Files:**
- Create: `apps/web/e2e/venue-approval.spec.ts`

**Interfaces:**
- Consumes: `loginAs`, `createDraftVenue` from `./helpers`.

Uses two separate browser contexts (owner, admin) since the flow spans two sessions.

- [ ] **Step 1: Write the spec.**

  ```typescript
  import { expect, test } from "@playwright/test";
  import { createDraftVenue, loginAs } from "./helpers";

  test.describe("venue approval (needs seeded API)", () => {
    test("admin approving a pending venue makes it publicly visible", async ({ browser, request }) => {
      const ownerContext = await browser.newContext();
      const ownerPage = await ownerContext.newPage();
      const ownerLoggedIn = await loginAs(ownerPage, "owner@demo.courtlink.ph");
      test.skip(!ownerLoggedIn, "API not running or demo owner seed missing");

      const venue = await createDraftVenue(ownerPage, { name: "E2E Approval Test Venue" });
      const submit = await ownerPage
        .context()
        .request.post(`/api/v1/venues/${venue.id}/submit`);
      expect(submit.ok(), await submit.text()).toBe(true);
      await ownerContext.close();

      const before = await request.get(`/api/v1/venues/by-slug/${venue.slug}`);
      expect(before.status()).toBe(400); // not APPROVED yet, so not publicly resolvable

      const adminContext = await browser.newContext();
      const adminPage = await adminContext.newPage();
      const adminLoggedIn = await loginAs(adminPage, "admin@demo.courtlink.ph");
      test.skip(!adminLoggedIn, "API not running or demo admin seed missing");

      await adminPage.goto("/admin");
      const card = adminPage
        .locator("div")
        .filter({ hasText: venue.name })
        .filter({ has: adminPage.getByRole("button", { name: "Approve" }) })
        .last();
      await expect(card).toBeVisible();
      await card.getByRole("button", { name: "Approve" }).click();
      await expect(card).not.toBeVisible();
      await adminContext.close();

      const after = await request.get(`/api/v1/venues/by-slug/${venue.slug}`);
      expect(after.ok()).toBe(true);
      expect((await after.json()).status).toBe("APPROVED");
    });
  });
  ```

- [ ] **Step 2: Run it.**
  ```bash
  cd apps/web
  pnpm exec playwright test e2e/venue-approval.spec.ts
  ```
  Expected: `1 passed`.

- [ ] **Step 3: Run `pnpm exec biome check e2e/venue-approval.spec.ts` and fix any issues.**

- [ ] **Step 4: Commit.**
  ```bash
  git add apps/web/e2e/venue-approval.spec.ts
  git commit -m "test(web): e2e coverage for admin venue approval"
  ```

---

### Task 10: `moderation.spec.ts`

**Files:**
- Create: `apps/web/e2e/moderation.spec.ts`

**Interfaces:**
- Consumes: `loginAs`, `createDraftVenue`, `acceptNextPrompt` from `./helpers`.

- [ ] **Step 1: Write the spec.**

  ```typescript
  import { expect, test } from "@playwright/test";
  import { acceptNextPrompt, createDraftVenue, loginAs } from "./helpers";

  test.describe("moderation (needs seeded API)", () => {
    test("reporting a venue creates a case; admin suspending removes it from public listings", async ({
      browser,
      request,
    }) => {
      const ownerContext = await browser.newContext();
      const ownerPage = await ownerContext.newPage();
      const ownerLoggedIn = await loginAs(ownerPage, "owner@demo.courtlink.ph");
      test.skip(!ownerLoggedIn, "API not running or demo owner seed missing");

      const venue = await createDraftVenue(ownerPage, { name: "E2E Moderation Test Venue" });
      await ownerPage.context().request.post(`/api/v1/venues/${venue.id}/submit`);
      await ownerContext.close();

      const adminSetupContext = await browser.newContext();
      const adminSetupPage = await adminSetupContext.newPage();
      await loginAs(adminSetupPage, "admin@demo.courtlink.ph");
      const approve = await adminSetupPage
        .context()
        .request.post(`/api/v1/venues/admin/${venue.id}/approve`);
      expect(approve.ok(), await approve.text()).toBe(true);
      await adminSetupContext.close();

      const playerContext = await browser.newContext();
      const playerPage = await playerContext.newPage();
      const playerLoggedIn = await loginAs(playerPage, "player@demo.courtlink.ph");
      test.skip(!playerLoggedIn, "API not running or demo player seed missing");

      await playerPage.goto(`/courts/${venue.slug}`);
      acceptNextPrompt(playerPage, "E2E test report — impersonating a real venue");
      await playerPage.getByRole("button", { name: "Report" }).click();
      await expect(playerPage.getByText("Report submitted. Thank you.")).toBeVisible();
      await playerContext.close();

      const beforeSuspend = await request.get(`/api/v1/venues/by-slug/${venue.slug}`);
      expect(beforeSuspend.ok()).toBe(true);

      const adminContext = await browser.newContext();
      const adminPage = await adminContext.newPage();
      await loginAs(adminPage, "admin@demo.courtlink.ph");
      await adminPage.goto("/admin/moderation");
      const card = adminPage
        .locator("div")
        .filter({ hasText: venue.name })
        .filter({ has: adminPage.getByRole("button", { name: "Suspend" }) })
        .last();
      await expect(card).toBeVisible();
      await card.getByRole("button", { name: "Suspend" }).click();
      await expect(card.getByRole("button", { name: "Reinstate" })).toBeVisible();
      await adminContext.close();

      const afterSuspend = await request.get(`/api/v1/venues/by-slug/${venue.slug}`);
      expect(afterSuspend.status()).toBe(400); // suspended venues no longer resolve publicly
    });
  });
  ```

- [ ] **Step 2: Run it.**
  ```bash
  cd apps/web
  pnpm exec playwright test e2e/moderation.spec.ts
  ```
  Expected: `1 passed`.

- [ ] **Step 3: Run `pnpm exec biome check e2e/moderation.spec.ts` and fix any issues.**

- [ ] **Step 4: Commit.**
  ```bash
  git add apps/web/e2e/moderation.spec.ts
  git commit -m "test(web): e2e coverage for reporting and suspending a venue"
  ```

---

### Task 11: Split e2e into a 3-leg CI matrix

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: all e2e spec files that now exist (Tasks 4-10 plus the pre-existing `auth.spec.ts`, `public-pages.spec.ts`, `shell.spec.ts`, `venue-photos.spec.ts`).

This is the CI change that keeps wall-clock time flat as the spec count grows. Each matrix leg repeats the full bootstrap from Task 1 (its own Postgres/Redis/MinIO/API), since GitHub Actions matrix jobs run as fully independent job instances.

- [ ] **Step 1: Convert the `verify` job's e2e step into a 3-way matrix.** This requires splitting `verify` into two jobs: `verify` keeps `pnpm check` and `pnpm test:integration` (they don't need the e2e-specific matrix), and a new `e2e` job runs the matrix with its own service containers.

  Replace the single `verify` job in `.github/workflows/ci.yml` with:

  ```yaml
  jobs:
    verify:
      runs-on: ubuntu-latest
      timeout-minutes: 20
      services:
        postgres:
          image: postgres:17.5-alpine
          env:
            POSTGRES_DB: courtlink
            POSTGRES_USER: courtlink
            POSTGRES_PASSWORD: courtlink
          ports:
            - 5432:5432
          options: >-
            --health-cmd "pg_isready -U courtlink -d courtlink"
            --health-interval 5s
            --health-timeout 3s
            --health-retries 10
        redis:
          image: redis:7.4.3-alpine
          ports:
            - 6379:6379
          options: >-
            --health-cmd "redis-cli ping"
            --health-interval 5s
            --health-timeout 3s
            --health-retries 10
      env:
        DATABASE_URL: postgresql://courtlink:courtlink@localhost:5432/courtlink?schema=public
        REDIS_URL: redis://localhost:6379
        NEXT_TELEMETRY_DISABLED: "1"
        TURBO_TELEMETRY_DISABLED: "1"
      steps:
        - uses: actions/checkout@v7
        - uses: pnpm/action-setup@v6
          with:
            version: 11.8.0
            run_install: false
        - uses: actions/setup-node@v6
          with:
            node-version: 24
            cache: pnpm
        - run: pnpm install --frozen-lockfile
        - run: pnpm --filter @courtlink/database db:migrate
        - run: pnpm check
        - run: pnpm test:integration
        - name: Validate development Compose config
          run: docker compose -f compose.yaml config --quiet
        - name: Validate production Compose config
          env:
            APP_BASE_URL: http://localhost:3000
            BACKUP_ENCRYPTION_KEY: ci-backup-encryption-key
            DATABASE_URL: postgresql://courtlink:courtlink@postgres:5432/courtlink?schema=public
            ENCRYPTION_KEY: ci-encryption-key
            OBJECT_STORAGE_ACCESS_KEY: ci-access-key
            OBJECT_STORAGE_BUCKET: courtlink-ci
            OBJECT_STORAGE_ENDPOINT: http://minio:9000
            OBJECT_STORAGE_SECRET_KEY: ci-secret-key
            POSTGRES_PASSWORD: courtlink
            SESSION_SECRET: ci-session-secret
          run: docker compose -f compose.prod.yaml config --quiet

    e2e:
      runs-on: ubuntu-latest
      timeout-minutes: 20
      strategy:
        fail-fast: false
        matrix:
          suite:
            - name: public
              specs: e2e/public-pages.spec.ts e2e/shell.spec.ts e2e/auth.spec.ts
            - name: commerce
              specs: e2e/venue-photos.spec.ts e2e/promotions.spec.ts e2e/amenities.spec.ts e2e/favorites.spec.ts e2e/reviews.spec.ts e2e/registration.spec.ts
            - name: moderation
              specs: e2e/moderation.spec.ts e2e/venue-approval.spec.ts
      services:
        postgres:
          image: postgres:17.5-alpine
          env:
            POSTGRES_DB: courtlink
            POSTGRES_USER: courtlink
            POSTGRES_PASSWORD: courtlink
          ports:
            - 5432:5432
          options: >-
            --health-cmd "pg_isready -U courtlink -d courtlink"
            --health-interval 5s
            --health-timeout 3s
            --health-retries 10
        redis:
          image: redis:7.4.3-alpine
          ports:
            - 6379:6379
          options: >-
            --health-cmd "redis-cli ping"
            --health-interval 5s
            --health-timeout 3s
            --health-retries 10
      env:
        DATABASE_URL: postgresql://courtlink:courtlink@localhost:5432/courtlink?schema=public
        REDIS_URL: redis://localhost:6379
        NEXT_TELEMETRY_DISABLED: "1"
        TURBO_TELEMETRY_DISABLED: "1"
      steps:
        - uses: actions/checkout@v7
        - uses: pnpm/action-setup@v6
          with:
            version: 11.8.0
            run_install: false
        - uses: actions/setup-node@v6
          with:
            node-version: 24
            cache: pnpm
        - run: pnpm install --frozen-lockfile
        - run: pnpm --filter @courtlink/web exec playwright install --with-deps chromium
        - run: pnpm --filter @courtlink/database db:migrate
        - run: pnpm --filter @courtlink/database db:seed
        - name: Start MinIO
          run: |
            docker run -d --name minio -p 9000:9000 \
              -e MINIO_ROOT_USER=courtlink \
              -e MINIO_ROOT_PASSWORD=courtlink-dev-secret \
              minio/minio:RELEASE.2025-04-22T22-12-26Z server /data
            for i in $(seq 1 20); do
              curl -sf http://localhost:9000/minio/health/live && break
              sleep 1
            done
        - name: Start API
          env:
            SESSION_SECRET: ci-session-secret-32-characters-min
            ENCRYPTION_KEY: Y2ktZW5jcnlwdGlvbi1rZXktMzItYnl0ZXMtbG9uZyEh
            OBJECT_STORAGE_ENDPOINT: http://localhost:9000
            OBJECT_STORAGE_BUCKET: courtlink-ci
            OBJECT_STORAGE_ACCESS_KEY: courtlink
            OBJECT_STORAGE_SECRET_KEY: courtlink-dev-secret
          run: |
            pnpm --filter @courtlink/api build
            pnpm --filter @courtlink/api start &
            for i in $(seq 1 30); do
              curl -sf http://localhost:3001/api/v1/health/live && break
              sleep 1
            done
        - name: Run e2e (${{ matrix.suite.name }})
          env:
            API_PROXY_TARGET: http://localhost:3001
          working-directory: apps/web
          run: pnpm exec playwright test ${{ matrix.suite.specs }}
  ```

  Note: the `e2e` job's `DATABASE_URL`/`REDIS_URL` intentionally match `verify`'s, but each is a **separate job** with its own fresh service containers — there's no cross-job data sharing, so this is safe.

- [ ] **Step 2: Remove Task 1's changes from the (now integration-only) `verify` job** if Task 1 was implemented as a single job — the MinIO/seed/API-start steps belong only in the new `e2e` job now, per the YAML above. Confirm `verify` no longer references `minio`, `db:seed`, or "Start API".

- [ ] **Step 3: Push and confirm both `verify` and all three `e2e (suite)` matrix jobs appear and pass in the Actions tab.**
  ```bash
  git add .github/workflows/ci.yml
  git commit -m "ci: split e2e into a 3-leg matrix so wall-clock time stays flat"
  git push
  ```

- [ ] **Step 4: If the repo's branch protection lists a specific required status check name (e.g. \"verify\"), update it to also require the three new `e2e / *` checks.** Check via:
  ```bash
  gh api repos/:owner/:repo/branches/main/protection/required_status_checks
  ```
  If it only lists `verify`, add the matrix job names (`e2e (public)`, `e2e (commerce)`, `e2e (moderation)`) with:
  ```bash
  gh api -X PATCH repos/:owner/:repo/branches/main/protection/required_status_checks \
    -f strict=true \
    -f 'contexts[]=verify' \
    -f 'contexts[]=e2e (public)' \
    -f 'contexts[]=e2e (commerce)' \
    -f 'contexts[]=e2e (moderation)'
  ```

---

### Task 12: `logout-button.test.tsx`

**Files:**
- Create: `apps/web/components/logout-button.test.tsx`

**Interfaces:**
- Consumes: `LogoutButton` from `./logout-button`.

- [ ] **Step 1: Write the failing test.**

  ```typescript
  import { cleanup, fireEvent, render, screen } from "@testing-library/react";
  import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
  import { LogoutButton } from "./logout-button";

  const push = vi.fn();
  const refresh = vi.fn();
  vi.mock("next/navigation", () => ({
    useRouter: () => ({ push, refresh }),
  }));

  describe("LogoutButton", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
      push.mockReset();
      refresh.mockReset();
      fetchMock.mockReset();
      vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
      cleanup();
      vi.unstubAllGlobals();
    });

    it("calls the logout endpoint and redirects home", async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
      render(<LogoutButton />);

      fireEvent.click(screen.getByRole("button", { name: "Log out" }));

      await vi.waitFor(() => {
        expect(push).toHaveBeenCalledWith("/");
      });
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/auth/logout"),
        expect.objectContaining({ method: "POST" }),
      );
      expect(refresh).toHaveBeenCalled();
    });

    it("disables the button while the request is pending", async () => {
      let resolveFetch: (value: Response) => void = () => {};
      fetchMock.mockReturnValue(
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
      );
      render(<LogoutButton />);

      const button = screen.getByRole("button", { name: "Log out" });
      fireEvent.click(button);
      expect(button).toBeDisabled();

      resolveFetch(new Response(null, { status: 204 }));
      await vi.waitFor(() => expect(button).not.toBeDisabled());
    });
  });
  ```

- [ ] **Step 2: Run to verify it fails (or passes, if `LogoutButton` behaves as expected already — this is a new-coverage test, not a bugfix, so either outcome is informative).**
  ```bash
  cd apps/web
  pnpm exec vitest run components/logout-button.test.tsx
  ```

- [ ] **Step 3: If it fails, fix the test (not the component) to match actual behavior** — `logout-button.tsx` is existing, working, unmodified code; a failure here means the test's assumptions about `apiFetch`'s underlying `fetch` call shape are wrong, not that the component is broken. Check `apps/web/lib/api.ts`'s `apiFetch` implementation for the exact URL/init shape it passes to `fetch` if the assertion on `fetchMock` fails.

- [ ] **Step 4: Run again to confirm both tests pass.**
  ```bash
  pnpm exec vitest run components/logout-button.test.tsx
  ```
  Expected: `2 passed`.

- [ ] **Step 5: Commit.**
  ```bash
  git add apps/web/components/logout-button.test.tsx
  git commit -m "test(web): unit coverage for LogoutButton"
  ```

---

### Task 13: `notification-bell.test.tsx`

**Files:**
- Create: `apps/web/components/notification-bell.test.tsx`

**Interfaces:**
- Consumes: `NotificationBell` from `./notification-bell`.

- [ ] **Step 1: Write the test.** `NotificationBell` polls `/notifications/unread-count` on mount via `setInterval`; use fake timers to control that without a real 60-second wait.

  ```typescript
  import { cleanup, render, screen } from "@testing-library/react";
  import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
  import { NotificationBell } from "./notification-bell";

  function jsonResponse(body: unknown) {
    return new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  }

  describe("NotificationBell", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
      fetchMock.mockReset();
      vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
      cleanup();
      vi.unstubAllGlobals();
    });

    it("shows no badge when the unread count is zero", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ count: 0 }));
      render(<NotificationBell />);

      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
      expect(screen.queryByText("0")).not.toBeInTheDocument();
    });

    it("shows the unread count as a badge", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ count: 3 }));
      render(<NotificationBell />);

      expect(await screen.findByText("3")).toBeInTheDocument();
    });

    it("caps the badge at 99+", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ count: 140 }));
      render(<NotificationBell />);

      expect(await screen.findByText("99+")).toBeInTheDocument();
    });

    it("links to the notifications page", () => {
      fetchMock.mockResolvedValue(jsonResponse({ count: 0 }));
      render(<NotificationBell />);

      expect(screen.getByRole("link", { name: "Notifications" })).toHaveAttribute(
        "href",
        "/notifications",
      );
    });
  });
  ```

- [ ] **Step 2: Run to verify it fails first (file doesn't exist yet as a test target — expect module resolution to succeed since the component exists, but run before Step 1 was written mentally; practically this project runs immediately).**
  ```bash
  cd apps/web
  pnpm exec vitest run components/notification-bell.test.tsx
  ```

- [ ] **Step 3: If any assertion fails, adjust the test (not the component)** to match `NotificationBell`'s actual rendered text — re-read `apps/web/components/notification-bell.tsx` if the badge text format differs from what's asserted.

- [ ] **Step 4: Run again to confirm all four tests pass.**
  ```bash
  pnpm exec vitest run components/notification-bell.test.tsx
  ```
  Expected: `4 passed`.

- [ ] **Step 5: Commit.**
  ```bash
  git add apps/web/components/notification-bell.test.tsx
  git commit -m "test(web): unit coverage for NotificationBell"
  ```

---

### Task 14: `notification-list.test.tsx`

**Files:**
- Create: `apps/web/components/notification-list.test.tsx`

**Interfaces:**
- Consumes: `NotificationList` from `./notification-list`.

- [ ] **Step 1: Write the test.**

  ```typescript
  import { cleanup, fireEvent, render, screen } from "@testing-library/react";
  import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
  import { NotificationList } from "./notification-list";

  const refresh = vi.fn();
  vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

  const items = [
    {
      id: "notif-1",
      type: "COURT_BOOKING_CONFIRMED",
      title: "Your booking is confirmed",
      body: "The venue approved your payment.",
      createdAt: "2026-06-01T02:00:00.000Z",
      readAt: null,
    },
    {
      id: "notif-2",
      type: "COURT_PROOF_REJECTED",
      title: "Payment proof rejected",
      body: "Please resubmit.",
      createdAt: "2026-06-02T02:00:00.000Z",
      readAt: "2026-06-02T03:00:00.000Z",
    },
  ];

  function jsonResponse(body: unknown) {
    return new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  }

  describe("NotificationList", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
      refresh.mockReset();
      fetchMock.mockReset();
      vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
      cleanup();
      vi.unstubAllGlobals();
    });

    it("shows an empty state when there are no notifications", () => {
      render(<NotificationList initial={[]} />);
      expect(screen.getByText("No notifications yet")).toBeInTheDocument();
    });

    it("marks a single notification as read on click", async () => {
      fetchMock.mockResolvedValue(jsonResponse({}));
      render(<NotificationList initial={items} />);

      fireEvent.click(screen.getByText("Your booking is confirmed"));

      await vi.waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/api/v1/notifications/notif-1/read"),
          expect.objectContaining({ method: "POST" }),
        );
      });
      expect(refresh).toHaveBeenCalled();
    });

    it("marks all notifications as read", async () => {
      fetchMock.mockResolvedValue(jsonResponse({}));
      render(<NotificationList initial={items} />);

      fireEvent.click(screen.getByRole("button", { name: "Mark all read" }));

      await vi.waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/api/v1/notifications/read-all"),
          expect.objectContaining({ method: "POST" }),
        );
      });
    });
  });
  ```

- [ ] **Step 2: Run it.**
  ```bash
  cd apps/web
  pnpm exec vitest run components/notification-list.test.tsx
  ```

- [ ] **Step 3: If any assertion fails, adjust the test to match `NotificationList`'s actual behavior** (re-check `apps/web/components/notification-list.tsx` for the exact fetch call shape if needed).

- [ ] **Step 4: Run again to confirm all three tests pass.**
  ```bash
  pnpm exec vitest run components/notification-list.test.tsx
  ```
  Expected: `3 passed`.

- [ ] **Step 5: Commit.**
  ```bash
  git add apps/web/components/notification-list.test.tsx
  git commit -m "test(web): unit coverage for NotificationList"
  ```

---

### Task 15: `venue-queue.test.tsx`

**Files:**
- Create: `apps/web/components/venue-queue.test.tsx`

**Interfaces:**
- Consumes: `VenueQueue` from `./venue-queue`.

- [ ] **Step 1: Write the test.** Covers the proof-approve action (no prompt) and the cancel-with-reason action (prompt-gated, using `vi.spyOn(window, "prompt")`).

  ```typescript
  import { cleanup, fireEvent, render, screen } from "@testing-library/react";
  import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
  import { ToastProvider } from "./ui";
  import { VenueQueue } from "./venue-queue";

  const refresh = vi.fn();
  vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

  const proofBooking = {
    id: "booking-1",
    status: "PROOF_SUBMITTED",
    startsAt: "2026-06-01T02:00:00.000Z",
    quotedAmount: 250,
    court: { name: "Court 1" },
    venue: { name: "Riverside Pickleball" },
    submission: { id: "sub-1", channel: "GCASH", transactionRef: "REF123" },
  };

  function jsonResponse(body: unknown) {
    return new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  }

  describe("VenueQueue", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
      refresh.mockReset();
      fetchMock.mockReset();
      vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
      cleanup();
      vi.unstubAllGlobals();
    });

    it("shows an empty state when there is nothing to review", () => {
      render(
        <ToastProvider>
          <VenueQueue bookings={[]} />
        </ToastProvider>,
      );
      expect(screen.getByText("Nothing to review right now")).toBeInTheDocument();
    });

    it("approves a proof submission", async () => {
      fetchMock.mockResolvedValue(jsonResponse({}));
      render(
        <ToastProvider>
          <VenueQueue bookings={[proofBooking as never]} />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: /Approve/ }));

      await vi.waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/api/v1/courts/bookings/proof/approve"),
          expect.objectContaining({ method: "POST" }),
        );
      });
      expect(refresh).toHaveBeenCalled();
    });

    it("rejects a proof submission with a prompted reason", async () => {
      fetchMock.mockResolvedValue(jsonResponse({}));
      vi.spyOn(window, "prompt").mockReturnValue("Blurry receipt");
      render(
        <ToastProvider>
          <VenueQueue bookings={[proofBooking as never]} />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: /Reject/ }));

      await vi.waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/api/v1/courts/bookings/proof/reject"),
          expect.objectContaining({ method: "POST" }),
        );
      });
    });

    it("does not call the API when the reject prompt is cancelled", () => {
      vi.spyOn(window, "prompt").mockReturnValue(null);
      render(
        <ToastProvider>
          <VenueQueue bookings={[proofBooking as never]} />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: /Reject/ }));
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
  ```

- [ ] **Step 2: Run it.**
  ```bash
  cd apps/web
  pnpm exec vitest run components/venue-queue.test.tsx
  ```

- [ ] **Step 3: If any assertion fails, adjust the test to match `VenueQueue`'s actual `BookingListItem` shape** — re-check `apps/web/lib/api.ts`'s `BookingListItem` type if the component throws on the fixture shape used above.

- [ ] **Step 4: Run again to confirm all four tests pass.**
  ```bash
  pnpm exec vitest run components/venue-queue.test.tsx
  ```
  Expected: `4 passed`.

- [ ] **Step 5: Commit.**
  ```bash
  git add apps/web/components/venue-queue.test.tsx
  git commit -m "test(web): unit coverage for VenueQueue proof approve/reject"
  ```

---

### Task 16: `coach-workspace.test.tsx`

**Files:**
- Create: `apps/web/components/coach-workspace.test.tsx`

**Interfaces:**
- Consumes: `CoachWorkspace` from `./coach-workspace`.

Scoped to the "directed requests" approve/decline actions — the clearest, most isolated interactive block in this component (verified by reading `apps/web/components/coach-workspace.tsx` in full during planning).

- [ ] **Step 1: Write the test.**

  ```typescript
  import { cleanup, fireEvent, render, screen } from "@testing-library/react";
  import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
  import { ToastProvider } from "./ui";
  import { CoachWorkspace } from "./coach-workspace";

  const refresh = vi.fn();
  vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

  const me = {
    profile: { hourlyRate: 800, bio: "Bio", experience: "Experience" },
    availability: [],
  };

  const directedRequest = {
    id: "req-1",
    player: { displayName: "Demo Player" },
    groupSize: 2,
    startsAt: "2026-06-01T02:00:00.000Z",
    location: "Riverside Pickleball",
    goals: "Improve serve consistency",
  };

  function jsonResponse(body: unknown) {
    return new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  }

  describe("CoachWorkspace directed requests", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
      refresh.mockReset();
      fetchMock.mockReset();
      vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
      cleanup();
      vi.unstubAllGlobals();
    });

    it("shows an empty state when there are no directed requests", () => {
      render(
        <ToastProvider>
          <CoachWorkspace me={me as never} jobs={[]} bookings={[]} directed={[]} />
        </ToastProvider>,
      );
      expect(
        screen.getByText("No directed requests awaiting your approval"),
      ).toBeInTheDocument();
    });

    it("approves a directed request", async () => {
      fetchMock.mockResolvedValue(jsonResponse({}));
      render(
        <ToastProvider>
          <CoachWorkspace
            me={me as never}
            jobs={[]}
            bookings={[]}
            directed={[directedRequest as never]}
          />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: /Approve/ }));

      await vi.waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/api/v1/coaches/requests/req-1/approve"),
          expect.objectContaining({ method: "POST" }),
        );
      });
      expect(refresh).toHaveBeenCalled();
    });

    it("declines a directed request", async () => {
      fetchMock.mockResolvedValue(jsonResponse({}));
      render(
        <ToastProvider>
          <CoachWorkspace
            me={me as never}
            jobs={[]}
            bookings={[]}
            directed={[directedRequest as never]}
          />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: /Decline/ }));

      await vi.waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/api/v1/coaches/requests/req-1/decline"),
          expect.objectContaining({ method: "POST" }),
        );
      });
    });
  });
  ```

- [ ] **Step 2: Run it.**
  ```bash
  cd apps/web
  pnpm exec vitest run components/coach-workspace.test.tsx
  ```

- [ ] **Step 3: If any assertion fails, adjust the test to match `CoachWorkspace`'s actual `CoachMe`/`DirectedRequest` type shapes** — re-check `apps/web/lib/api.ts` for those types if the component throws on the fixture shape used above.

- [ ] **Step 4: Run again to confirm all three tests pass.**
  ```bash
  pnpm exec vitest run components/coach-workspace.test.tsx
  ```
  Expected: `3 passed`.

- [ ] **Step 5: Commit.**
  ```bash
  git add apps/web/components/coach-workspace.test.tsx
  git commit -m "test(web): unit coverage for CoachWorkspace directed-request actions"
  ```

---

## Deferred (not in this plan's scope)

- **`player-coaching.test.tsx`** — `player-coaching.tsx` (249 lines) was not read in full during planning, and writing accurate test code for it without doing so would risk fabricated assertions against a component this plan's author hasn't verified. Read it and repeat Task 12's pattern (write test, run, adjust to actual behavior, commit) as a follow-up task using this same plan document as a template.
- **CI visual regression parity (Linux baselines)** — explicitly out of scope per the design spec's non-goals section.

## Self-Review

**Spec coverage:** the design spec's three foundation items (CI API bootstrap, seed data, matrix split) map to Tasks 1, 2, 11. All seven Tier 1 e2e flows (moderation, venue-approval, promotions, amenities, reviews, registration, favorites) map to Tasks 4-10. Five of six Tier 2 unit tests map to Tasks 12-16; `player-coaching` is explicitly deferred above rather than silently dropped.

**Placeholder scan:** no TBD/TODO markers; every step has complete, runnable code derived from files read during planning (component source, controller routes, seed script, existing e2e/unit test conventions).

**Type consistency:** `acceptNextPrompt`, `getOwnerBusinessId`, and `createDraftVenue` (Task 3) are used with matching signatures in Tasks 9 and 10. `loginAs` is used consistently with its existing signature (`Page, string) => Promise<boolean>`) from `apps/web/e2e/helpers.ts` across Tasks 4-10.
