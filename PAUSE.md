# CourtLink PH Pause / Resume Handoff

Last updated: 2026-07-03 (Asia/Manila)

## Resume prompt

> Resume CourtLink PH from `PAUSE.md`. **Active effort: test coverage expansion.** Spec is
> `docs/superpowers/specs/2026-07-03-test-coverage-expansion-design.md`, plan is
> `docs/superpowers/plans/2026-07-03-test-coverage-expansion.md` (17 tasks, none started).
> The owner wants this executed via **subagent-driven development**
> (`superpowers:subagent-driven-development` — fresh subagent per task, review between tasks)
> once they say go; do not start Task 1 until explicitly told to. House rules: work on `main`;
> gate with `pnpm check` + `pnpm --filter @courtlink/web test:e2e` before each commit; plain
> commit messages without co-author trailers; update `PAUSE.md` before stopping.
>
> Prior effort (complete, for context only): the 10-phase web experience redesign — all phases
> checked off in `docs/superpowers/plans/2026-07-02-web-experience-redesign.md`, final audit at
> `docs/verification/2026-07-03-web-redesign-audit.md`.

## Current checkpoint

- Public repository: `https://github.com/AdrianVyne/courtlink-ph`
- Branch: `main`, clean and pushed at this pause.
- Recent repository maintenance: contributor guardrails added in `e6bba3c` and Dependabot security
  alerts remediated in `98010f8`. `main` now requires PR review, CODEOWNER review, the `verify`
  status check, resolved conversations, linear history, and no force-push/delete for non-bypass
  users. Squash merge is the only enabled merge method. Secret scanning and push protection are on;
  private vulnerability reporting and Dependabot security updates are enabled.
- Active effort: **web experience redesign** - spec and 10-phase plan committed 2026-07-02.
- Phase status: Phases 1-6 complete. Phase 1: tokens, display font, `components/ui/`
  primitives (24 unit tests). Phase 2: responsive header + mobile drawer, footer, 404/error/
  loading pages, visual snapshot harness (`apps/web/e2e/__screenshots__/`). Phase 3: landing
  rebuild (hero search, live-stats strip via new `GET /api/v1/stats/public`, how-it-works
  tabs, featured venues, coaches band, trust, FAQ, CTA). Phase 4: discovery redesign -
  FilterBar with removable chips + mobile sheet, VenueCard/CoachCard/CoverPlaceholder,
  venue + coach detail pages migrated, legacy discovery CSS removed. Phase 5: Toast+Countdown
  primitives, workspaces (dashboard/manage/coach/admin/notifications) on WorkspaceShell with
  StatusPill, toasts, loading buttons; auth pages with password toggle. Phase 6: trust pages
  (/about /contact /faq /terms /privacy on shared `ContentPage`), `lib/site.ts` +
  `lib/jsonld.ts` (venue/coach/organization JSON-LD with escaping serializer, 13 unit tests),
  layout title template + OG defaults + `metadataBase`, venue detail `generateMetadata`,
  sitemap/robots/opengraph-image routes, manifest categories, `SITE_URL` in `.env.example`;
  e2e now navigates footer links, axe covers all 10 public routes, SEO endpoints smoke-tested.
  Also fixed `e2e/helpers.ts` `loginAs` (pre-hydration native form submit made the dashboard
  axe test skip silently; it now waits for networkidle and sniffs the login POST with retries).
  Next: Phase 7 (legacy CSS retirement).
- Phase 7 complete (2026-07-02): every component migrated off legacy classes (rating-badge,
  report-button, notification-bell, logout-button, google-sign-in, promotion-banner/manager,
  venue-amenity-manager, operations-status, court-schedule-manager, offline page, manage page).
  `globals.css` reduced 961 -> 110 lines (theme, base html/body/a/h1-h2 rules, `.tnum`, reveal
  keyframes, reduced-motion). Visual snapshots passed with zero diffs. Next: Phase 8
  (venue photos - schema, API with re-encode pipeline, manager UI, next/image).
- Phase 8 complete (2026-07-03): venue photo galleries end to end. API: `VenuePhotoService` +
  `VenuePhotosController` (upload with webp re-encode via the proof pipeline, 8-photo cap,
  alt-text validation, tenant-guarded mutations, position swap, public `302` redirect for
  approved venues, authorized `GET /venues/:venueId/photos`), discovery `coverPhotoUrl` +
  `coverPhotoAltText`, detail `photos[]`, `apps/api/integration/venue-photos.test.ts` (5/5).
  Web: `components/manage/venue-photo-manager.tsx` (+3 unit tests) wired into `/manage`, real
  photos on discovery cards and venue detail, `e2e/venue-photos.spec.ts` with upload/delete
  helpers in `e2e/helpers.ts`. Gate this session: `pnpm check` 18/18, functional e2e 41/41
  (API up + seed), visual snapshots 8/8 zero diffs (API stopped), full integration suite green
  after the flake fix below.
- Also fixed a pre-existing flaky test (separate commit): `apps/api/integration/public-stats.test.ts`
  compared `getPublicStats()` to `venue.count()` from two different read-committed snapshots, so
  a parallel test file's cleanup between the reads made approved-count exceed total-count. Both
  reads now run inside one `RepeatableRead` transaction.
- Phase 9 complete (2026-07-03): dark mode + motion polish. `[data-theme="dark"]` palette-variable
  remap in `globals.css` (warm green-ink surfaces `#0f1713`→`#16211a`→`#1c2921`, AA ratios
  documented in the CSS comment), `@custom-variant dark`, three-line `.bg-white` card override,
  scoped sand-var restore for always-dark `bg-court-950` bands. In dark, primary actions flip to
  lime with `court-950` text (Button primary + header/mobile CTAs + filter badge + active tab);
  focus rings go lime. `components/theme-toggle.tsx` (system→light→dark cycle, `courtlink-theme`
  in localStorage, 3 unit tests) mounted in header (md+) and mobile drawer; pre-paint inline
  script + `suppressHydrationWarning` in `layout.tsx`; dual `themeColor` viewport. Motion: card
  hover lift + `shadow-float` behind `motion-safe:`. E2e: axe suite runs both themes (20 checks),
  toggle persistence + pre-paint test, reduced-motion animation assertion, dark visual snapshots
  (landing/courts × 375/1280) plus refreshed light 1280 baselines (header now shows the toggle);
  `e2e/screenshot.css` hides the Next dev overlay from screenshots via `stylePath`.
- Session gotcha (2026-07-03): the Next 16 persistent dev cache under `apps/web/.next` served
  stale layout/header SSR after edits made while no dev server was running — visual baselines
  captured without the toggle/theme script, masked by `maxDiffPixelRatio: 0.02`. If a snapshot
  looks stale after editing shared components, delete `apps/web/.next` and regenerate.
- Phase 10 complete (2026-07-03): production Lighthouse (mobile perf preset, `next start` + API):
  landing **95**, courts **98** — landing was 89 until the hero-headline LCP fix (`.reveal-solid`
  rises without fading; the h1 is the LCP element). Optional map view deliberately skipped
  (venues have no coordinates yet) and recorded as a known gap. Final audit:
  `docs/verification/2026-07-03-web-redesign-audit.md`; README features/tech/verification
  refreshed (also repaired mojibake em-dashes from an old encoding accident).
- **The 10-phase web redesign effort is finished.** All phases checked off in the plan; every
  phase gated (pnpm check, functional e2e, visual snapshots, integration where relevant) and
  pushed; CI green on `main`.
- E2e gate has two documented states (see `apps/web/e2e/README.md`): functional specs run with
  the API up + demo seed (`pnpm --filter @courtlink/database db:seed`), visual snapshots match
  the empty-state baselines with the API stopped. Both were green for the Phase 6 commit.
- Local API env (no `.env` file in checkout): `DATABASE_URL`/`REDIS_URL` as below plus
  `SESSION_SECRET` (any 32+ chars), `ENCRYPTION_KEY` (32-byte base64),
  `OBJECT_STORAGE_ENDPOINT` `http://localhost:9000`, `OBJECT_STORAGE_BUCKET` `courtlink-private`,
  `OBJECT_STORAGE_ACCESS_KEY` `courtlink`, `OBJECT_STORAGE_SECRET_KEY`
  `courtlink-dev-secret` (matches compose MinIO).
- CI on `main` is green as of commit `98010f8`: GitHub Actions run `28571832540` (`CI` / `verify`)
  passed, and run `28571832579` (`Docker images`) passed for api, worker, and web images. The three
  Dependabot alerts opened after enabling security updates (`@hono/node-server`, `postcss`,
  `js-yaml`) are marked fixed by GitHub.
- Environment notes: root `node_modules` had a corrupt pnpm link tree (missing `tslib` under
  `@nestjs/core`) - fixed by full reinstall. `biome.json` now excludes `.worktrees`/`static`
  and enables `css.parser.tailwindDirectives`. Playwright Chromium reinstalled.
- Root checkout has unrelated untracked `config.yaml` and `static/` - do not touch.
- The `.worktrees/foundation` worktree is from the completed foundation effort; redesign work
  happens directly on `main` in the root checkout.

## Prior Effort

The marketplace is feature-complete: auth (email + Google OAuth), courts (inventory, discovery,
holds, proof review, refunds), coaches (profiles, offers, atomic winner), web workspaces,
notifications, email, operations, Docker/Caddy production stack, 240+ unit tests, 83 integration
tests, Playwright + axe e2e scaffold.

Known operational items (not blockers): CI dependency/container scans, live Google OAuth
verification, clean Oracle VM deployment.

## Local Commands

```powershell
Set-Location C:\Users\Admin\Documents\Github\pickelball-website
pnpm install
docker compose up -d
$env:DATABASE_URL='postgresql://courtlink:courtlink@localhost:5433/courtlink'
$env:REDIS_URL='redis://localhost:6379'
pnpm check
pnpm test:integration
pnpm --filter @courtlink/database db:seed
pnpm --filter @courtlink/web test:e2e   # dev server auto-starts; API must be running for data tests
```
