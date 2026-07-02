# CourtLink PH Pause / Resume Handoff

Last updated: 2026-07-02 (Asia/Manila)

## Resume prompt

> Resume CourtLink PH from `PAUSE.md`. Current effort: the web experience redesign. Read
> `docs/superpowers/specs/2026-07-02-web-experience-redesign-design.md` and execute
> `docs/superpowers/plans/2026-07-02-web-experience-redesign.md` phase by phase from the first
> unchecked phase. Work on `main`; run the phase gate (`pnpm check` +
> `pnpm --filter @courtlink/web test:e2e`) before each commit; push after each phase; plain
> commit messages without co-author trailers; update `PAUSE.md` before stopping.

## Current checkpoint

- Public repository: `https://github.com/AdrianVyne/courtlink-ph`
- Branch: `main` (latest pushed commit `98010f8`; marketplace feature-complete; see previous
  checkpoint below).
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
- Phase 7 in progress (Step 1 mostly done 2026-07-02). Migrated to token utilities/primitives
  and verified by the full gate: rating-badge, report-button, notification-bell, logout-button,
  google-sign-in (login visual snapshots pass with zero diff), promotion-banner,
  promotion-manager, venue-amenity-manager, operations-status, offline page (rebuilt on
  EmptyState-style layout with CourtLines), manage page stragglers. **Remaining:**
  `components/court-schedule-manager.tsx` (287 lines, the last legacy-class consumer; its test
  asserts `schedule-manager` — update in same commit), then the Step 2 `globals.css` shrink to
  < 250 lines (tailwind import, `@theme`, base rules, `.tnum`, reveal keyframes, reduced-motion;
  the `:root` legacy-variable block and all `@layer components` legacy classes go away — check
  nothing else references `var(--ink|--muted|--line|--surface|--soft|--green|--green-dark|
  --lime|--accent)` before deleting). Then Step 3: full gate + visual snapshots must show zero
  diffs (this phase must not change appearance). Useful recurring utility strings from the
  migration: form-error → `m-0 rounded-[10px] border border-[#f1b5b0] bg-danger-bg px-[0.8rem]
  py-[0.6rem] text-[0.88rem] text-danger-fg`; booking-row → `flex flex-wrap items-center
  justify-between gap-3 rounded-[10px] border border-sand-200 bg-white px-4 py-[0.85rem]`.
- E2e gate has two documented states (see `apps/web/e2e/README.md`): functional specs run with
  the API up + demo seed (`pnpm --filter @courtlink/database db:seed`), visual snapshots match
  the empty-state baselines with the API stopped. Both were green for the Phase 6 commit.
- Local API env (no `.env` file in checkout): DATABASE_URL/REDIS_URL as below plus
  SESSION_SECRET (any 32+ chars), ENCRYPTION_KEY (32-byte base64), OBJECT_STORAGE_ENDPOINT
  `http://localhost:9000`, OBJECT_STORAGE_BUCKET `courtlink-private`, OBJECT_STORAGE_ACCESS_KEY
  `courtlink`, OBJECT_STORAGE_SECRET_KEY `courtlink-dev-secret` (matches compose MinIO).
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
pnpm --filter @courtlink/web test:e2e   # dev server auto-starts; API must be running for data tests
```
