# Test coverage expansion — design

## Goal

Reduce the risk that adding new features regresses existing ones, by closing the two highest-value
gaps in the current test suite: browser-level proof that risky interactions still work (e2e), and
fast, isolated proof that untested interactive components still behave (unit tests). Coverage is
risk-based, not exhaustive — trivial/presentational components and flows already proven elsewhere
are deliberately skipped.

## Problem statement

CourtLink PH has a strong lower-layer regression net (20 integration test flows against a real
Postgres/Redis, plus unit tests for services/controllers) but two real gaps above that layer:

1. **43 of 54 web components have no dedicated test.** Re-classification during this design found
   the real number is smaller than it first looked — the `ui/*` primitive library (`Button`,
   `StatusPill`, `Field`, `EmptyState`, `Skeleton`, `Stat`, `Avatar`, `Badge`, `Card`, `CourtLines`,
   `Toast`, `Countdown`) is fully covered by `ui/ui.test.tsx` and `ui/toast-countdown.test.tsx`,
   which don't share a filename with the component they test. The real untested-and-risky set is
   about 20 components (see Design below).

2. **CI never boots the API for e2e tests, so a meaningful slice of the e2e suite silently
   skips on every PR.** Several existing specs guard themselves with
   `test.skip(!response || !response.ok(), "API is not running")` — venue detail axe, coach
   detail axe, the seeded-session dashboard axe check, and all of `venue-photos.spec.ts`. CI's
   `verify` job only starts the Next.js web server (via Playwright's `webServer` config); nothing
   starts the NestJS API on `:3001` or seeds the database. These specs pass in the sense of "0
   failures," but they assert nothing on every CI run today. This must be fixed first — adding
   more e2e specs without fixing it would just add more silently-skipping specs.

## Scope

**In scope:**
- Booting and seeding a real API in CI so "needs seeded API" specs (existing and new) actually run.
- Splitting the e2e CI step into a parallel matrix so wall-clock time stays reasonable as specs grow.
- New e2e specs for the highest-blast-radius untested interactions (Tier 1).
- New unit tests for the remaining logic-bearing untested components (Tier 2).

**Out of scope (explicit non-goals for this spec):**
- CI visual/pixel regression parity (Linux baselines). Stays local-only, unchanged. Separate effort
  if wanted later.
- Testing every one of the 54 components uniformly — trivial/presentational components and flows
  already covered by an existing e2e spec are deliberately skipped (see Design).
- Any product behavior change. This is test-only.

## Design

### 1. CI foundation: live, seeded API for e2e

Add a `minio` service to the `verify` job in `.github/workflows/ci.yml` (Postgres and Redis
services already exist there for `test:integration`). Before the e2e step:

1. Run `pnpm --filter @courtlink/database db:seed` against the CI Postgres.
2. Build and start the API in the background (`pnpm --filter @courtlink/api build && pnpm
   --filter @courtlink/api start` — both scripts already exist) with the same environment shape
   used locally this session: `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`, `ENCRYPTION_KEY`,
   `OBJECT_STORAGE_*` pointed at the new `minio` service.
3. Poll `GET /api/v1/health/live` (or `/stats/public`) until it responds before starting Playwright.

No application code changes are needed — `apps/web/next.config.ts` already proxies `/api/:path*` to
`API_PROXY_TARGET ?? http://localhost:3001`, which matches the default.

**Verification that this actually worked:** after this step lands, the existing "needs seeded API"
tests must show as *passed*, not *skipped*, in the CI log — that's the acceptance check for this
piece, independent of any new spec being written.

### 2. Split the e2e CI step into a matrix

Restructure the e2e invocation into a 3-leg GitHub Actions matrix (`strategy.matrix.suite: [public,
commerce, moderation]`), each leg repeating the Postgres/Redis/MinIO/API bootstrap from step 1 and
running only its spec group:

| Matrix leg | Spec files |
|---|---|
| `public` | `public-pages.spec.ts`, `shell.spec.ts`, `auth.spec.ts` (existing) |
| `commerce` | `venue-photos.spec.ts` (existing), `promotions.spec.ts`, `amenities.spec.ts`, `favorites.spec.ts`, `reviews.spec.ts`, `registration.spec.ts` (new) |
| `moderation` | `moderation.spec.ts`, `venue-approval.spec.ts` (new) |

`visual.spec.ts` is unaffected — it keeps `test.skip(!!process.env.CI, ...)` and stays a local-only
concern, per the out-of-scope note above.

### 3. New e2e specs (Tier 1 — highest blast radius)

Each new spec follows the existing pattern in `apps/web/e2e/`: real API, `loginAs()` from
`e2e/helpers.ts` for session setup, `test.skip` guards for missing seed data (matching the existing
style), cleanup of anything the test creates.

| Spec | Component(s) exercised | What it proves |
|---|---|---|
| `moderation.spec.ts` | `report-button`, `moderation-queue` | Reporting a venue creates a queue entry; admin approve/reject changes the venue's public visibility on `/courts`. |
| `venue-approval.spec.ts` | `admin-venue-queue` | Admin approve/reject on a pending venue changes whether it appears on `/courts`. |
| `promotions.spec.ts` | `promotion-manager`, `promotion-banner` | Owner-created promotion renders on venue detail; deactivating removes it. |
| `amenities.spec.ts` | `venue-amenity-manager` | Owner-saved amenities render on venue detail. |
| `reviews.spec.ts` | `review-form` | Player review on a completed booking appears on venue detail and updates the aggregate rating. |
| `registration.spec.ts` | `auth-form` (register mode) | Submitting registration creates an account and redirects to `/dashboard`. Closes an existing gap — today only "register page loads" is tested, not that submitting it works. |
| `favorites.spec.ts` | `favorite-toggle` | Toggling a favorite persists across reload. |

These are chosen because each mutates data with real consequences (public visibility, money-adjacent
state, account creation) and each component that drives them currently has zero coverage above the
API layer — if the click handler stops calling the right endpoint, or the UI stops reflecting the
response, nothing today would catch it.

### 4. New unit tests (Tier 2 — remaining logic-bearing components)

RTL tests with mocked `fetch`, following the existing pattern (`site-header.test.tsx`,
`venue-photo-manager.test.tsx`, `theme-toggle.test.tsx`):

- `venue-queue.test.tsx` — owner-side booking accept/reject/refund action buttons call the right
  endpoint and update UI state. (The business logic itself is already proven by
  `booking-flow.test.ts` and `refund-flow.test.ts`; this test's job is catching UI wiring breakage.)
- `coach-workspace.test.tsx` — offer/request actions.
- `player-coaching.test.tsx` — coach request/offer actions from the player side.
- `notification-bell.test.tsx` — unread-count polling, badge capping, and link target.
- `notification-list.test.tsx` — mark-as-read, mark-all-read, list rendering by status.
- `logout-button.test.tsx` — click → API call → redirect.

These are Tier 2 (unit, not e2e) because their blast radius is lower than Tier 1, or their critical
path already has integration-level proof and the remaining risk is UI wiring, which a unit test
catches just as well as an e2e test at a fraction of the CI cost.

### 5. Explicitly skipped (no new test)

Confirmed trivial (no state, no handlers, pure props → markup) or already covered elsewhere:

- All of `ui/*` — already fully covered by `ui.test.tsx` + `toast-countdown.test.tsx`.
- `content-page`, `site-footer`, `nav-links`, `rating-badge` — pure display.
- `discovery/coach-card`, `discovery/venue-card`, `discovery/cover-placeholder` — link cards, no
  own state; visually covered by the existing visual-snapshot suite and exercised by
  `venue-photos.spec.ts`.
- `promotion-banner`, `workspace-shell` — pure display/layout.
- `booking-list` — pure display; the one piece of real logic it embeds (`ReviewForm`) is covered by
  the new `reviews.spec.ts`.
- All of `landing/*` — either pure display (`cta-band`, `trust-section`, `coaches-band`,
  `featured-venues`, `proof-strip`), or already has a dedicated e2e assertion
  (`hero-search` and `how-it-works` in `public-pages.spec.ts`; `faq` accordion likewise).

## Risks and trade-offs

- **CI time.** Booting a real API per matrix leg adds real wall-clock time (build + migrate + seed
  + health-check) three times over. Mitigated by keeping the matrix at 3 legs rather than 1-per-spec,
  and by using the pre-built API rather than `nest start --watch`.
- **Flakiness surface increases** with more real-API e2e tests (network timing, seed data ordering).
  Follow the existing codebase convention of `test.skip` guards and `toPass()` retry loops
  (`e2e/shell.spec.ts`, `e2e/helpers.ts::loginAs`) rather than fixed sleeps.
- **Seed data coupling.** New specs that need specific seeded state (a completed booking to review,
  a pending venue to approve) must either rely on the existing demo seed having the right fixtures,
  or create-then-clean-up their own fixtures via the API (the pattern `venue-photos.spec.ts` and its
  `e2e/helpers.ts` upload/delete helpers already establish). Each spec's implementation task should
  check what the demo seed actually provides before writing assertions against it.

## Non-goals / follow-ups

- CI visual regression parity (Linux baselines) — separate future effort, noted here so it isn't
  forgotten, not designed here.
- Any e2e coverage beyond Tier 1's 7 flows was considered and rejected for this pass as
  disproportionate to CI cost versus the incremental regression protection gained.
