# Web Experience Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Read the spec first: `docs/superpowers/specs/2026-07-02-web-experience-redesign-design.md`. If the `frontend-design` skill is available, invoke it before styling work in Phases 1–4 and 9.

**Goal:** Rebuild the CourtLink PH web client into a contemporary, professional, conversion-oriented experience on a Tailwind 4 token system, with a regression test suite that grows with every phase.

**Architecture:** Tailwind CSS 4 `@theme` tokens + hand-built accessible primitives in `apps/web/components/ui/`; pages are migrated one phase at a time while legacy CSS classes keep un-migrated pages working; Playwright e2e (smoke + axe + screenshots) is the regression net.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4 (already installed), next/font (Geist + Bricolage Grotesque), Vitest, Playwright + axe-core, Prisma 7 (Phase 8 only), Leaflet (Phase 10, optional).

## Global Constraints

- Product visual spec: light-first, warm neutrals, court-green brand, lime accent, court-line SVG motif. Exact tokens in Phase 1 — do not invent new hex values elsewhere.
- No new UI dependency libraries (no Radix/HeadlessUI/shadcn). Native `<dialog>`, `popover`, `<details>` + explicit ARIA.
- WCAG 2.2 AA: axe e2e must pass on every public route after every phase.
- All timestamps display Asia/Manila; prices formatted with `₱` and `en-PH` locale (existing `peso()` helpers).
- Sentence case copy; buttons say what they do; errors are direction, not apology.
- **Phase gate (run before every commit):** `pnpm check` AND `pnpm --filter @courtlink/web test:e2e` (dev server auto-starts via playwright config; e2e needs the API running for data-driven tests — `docker compose up -d` + seeded DB, see README).
- **Commits:** plain descriptive messages, NO Co-Authored-By trailer (owner preference). Push to `origin main` after each phase passes the gate. Update `PAUSE.md` checkpoint at the end of every phase.
- Legacy CSS classes in `globals.css` must keep working for pages not yet migrated; delete a legacy block only in the phase that rebuilds its page (final sweep in Phase 7).

---

### Phase 1: Design system foundation (tokens, fonts, primitives)

**Files:**
- Modify: `apps/web/app/globals.css` (add `@theme` block at top; keep legacy classes below)
- Modify: `apps/web/app/layout.tsx` (add Bricolage Grotesque font)
- Create: `apps/web/components/ui/button.tsx`, `card.tsx`, `badge.tsx`, `status-pill.tsx`, `field.tsx` (Input/Select/Field), `empty-state.tsx`, `skeleton.tsx`, `stat.tsx`, `avatar.tsx`, `court-lines.tsx`, `index.ts`
- Test: `apps/web/components/ui/ui.test.tsx`

**Interfaces (later phases rely on these exact APIs):**

```tsx
// button.tsx
type ButtonProps = {
  variant?: "primary" | "secondary" | "ghost" | "danger"; // default "primary"
  size?: "sm" | "md";                                     // default "md"
  loading?: boolean;   // renders spinner, sets disabled + aria-busy
  href?: string;       // renders <Link> styled as button when set
} & (button | anchor native props);
export function Button(props: ButtonProps): JSX.Element;

// status-pill.tsx — single source of truth for ALL booking/offer statuses
export function StatusPill({ status }: { status: string }): JSX.Element;
// maps: CONFIRMED|COMPLETED|APPROVED→success; HELD|PROOF_SUBMITTED|PENDING_*|REFUND_REQUESTED→pending;
// REJECTED|CANCELLED|DECLINED|EXPIRED→danger; anything else→neutral. Case-insensitive.

// field.tsx
export function Field({ label, hint, error, children }): JSX.Element; // wires aria-describedby
export function Input(props: InputHTMLAttributes): JSX.Element;
export function Select(props: SelectHTMLAttributes): JSX.Element;

// empty-state.tsx
export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode });

// skeleton.tsx
export function Skeleton({ className }: { className?: string }); // pulse block, aria-hidden

// stat.tsx
export function Stat({ value, label }: { value: string; label: string }); // Bricolage numerals, tnum

// court-lines.tsx — the signature motif
export function CourtLines({ className, variant }: { className?: string; variant?: "field" | "corner" | "divider" });
// inline SVG of pickleball court geometry (sidelines, kitchen line, service boxes), currentColor strokes
```

- [x] **Step 1: Add the `@theme` token block** at the top of `globals.css` (directly after `@import "tailwindcss";`):

```css
@theme {
  --color-court-50: #eef6f1;
  --color-court-100: #e3efe7;
  --color-court-200: #c3ded0;
  --color-court-400: #4f9573;
  --color-court-600: #236b48;
  --color-court-700: #1b5e3f;
  --color-court-800: #14472f;
  --color-court-950: #0d2b1c;
  --color-lime-300: #e5f795;
  --color-lime-400: #d8f36b;
  --color-lime-500: #c4e648;
  --color-sand-50: #faf9f6;
  --color-sand-100: #f3f1ea;
  --color-sand-200: #e8e4da;
  --color-sand-300: #d6d0c2;
  --color-ink-900: #1a201c;
  --color-ink-700: #3c453f;
  --color-ink-500: #5f6a63;
  --color-success-bg: #e6f4ea;
  --color-success-fg: #1c6b3f;
  --color-pending-bg: #fdf3d7;
  --color-pending-fg: #8a5a00;
  --color-danger-bg: #fcebea;
  --color-danger-fg: #9a2a22;
  --color-info-bg: #e8f0fb;
  --color-info-fg: #1e4e8c;
  --font-display: var(--font-display), var(--font-sans), sans-serif;
  --radius-card: 12px;
  --radius-control: 10px;
  --shadow-float: 0 12px 32px rgb(13 43 28 / 0.12);
}
```

Then repoint the legacy variables so un-migrated pages inherit the new palette (`--soft: var(--color-sand-50)`, `--line: var(--color-sand-200)`, `--ink: var(--color-ink-900)`, `--muted: var(--color-ink-500)`, `--green: var(--color-court-700)`, `--green-dark: var(--color-court-800)`, `--lime: var(--color-lime-400)`). Also fix the pre-existing bug: `.breadcrumb a` and `.coach-rate-large` reference undefined `var(--accent)` — point them at `var(--color-court-700)`.

- [x] **Step 2: Add the display font.** In `layout.tsx`: `import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";` → `const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display" });` and add `${display.variable}` to the body className. Add a `.font-display` usage check: `h1, h2 { font-family: var(--font-display); }` in globals (legacy pages get the new voice immediately).
- [x] **Step 3: Write failing unit tests** in `apps/web/components/ui/ui.test.tsx` (Vitest + Testing Library, jsdom — mirror setup of `components/court-booking.test.tsx`). Cover at minimum: Button renders `<a>` when `href` set and `<button>` otherwise; `loading` sets `disabled` and `aria-busy="true"`; StatusPill maps `confirmed→success` class, `held→pending`, `rejected→danger`, unknown→neutral (assert via `data-tone` attribute, not class strings); Field wires `aria-describedby` from hint and error to the child input; EmptyState renders title and action; Stat renders value and label; CourtLines renders an `svg` with `aria-hidden="true"`.
- [x] **Step 4: Run to verify failure:** `pnpm --filter @courtlink/web test -- components/ui/ui.test.tsx` → FAIL (module not found).
- [x] **Step 5: Implement the primitives** with Tailwind utilities on the tokens (e.g. Button primary: `bg-court-700 hover:bg-court-800 text-white rounded-[10px] min-h-12 px-5 font-semibold inline-flex items-center justify-center gap-2 transition-colors`). StatusPill emits `data-tone="success|pending|danger|neutral"` plus tone utilities. CourtLines: one `<svg viewBox="0 0 440 200">` drawing outer boundary, centre net line, kitchen lines at ±64 from net, and service centreline — strokes `currentColor`, `strokeWidth 1.5`, `fill none`; `variant="corner"` renders a cropped 120×120 corner; `variant="divider"` a 440×24 baseline strip.
- [x] **Step 6: Run tests to verify pass**, then run full gate: `pnpm check` and `pnpm --filter @courtlink/web test:e2e`.
- [x] **Step 7: Commit + push:** `git add -A && git commit -m "feat(web): add design tokens, display font, and ui primitives" && git push origin main`. Update `PAUSE.md` checkpoint.

### Phase 2: App shell — header, mobile drawer, footer, system pages, screenshot harness

**Files:**
- Modify: `apps/web/components/site-header.tsx`, `apps/web/components/site-header.test.tsx`
- Create: `apps/web/components/mobile-nav.tsx` (client component)
- Create: `apps/web/components/site-footer.tsx`
- Create: `apps/web/app/not-found.tsx`, `apps/web/app/error.tsx` (client), `apps/web/app/courts/loading.tsx`, `apps/web/app/coaches/loading.tsx`, `apps/web/app/dashboard/loading.tsx`
- Modify: `apps/web/playwright.config.ts` (screenshot project settings)
- Create: `apps/web/e2e/shell.spec.ts`, `apps/web/e2e/visual.spec.ts`, `apps/web/e2e/README.md`

**Interfaces:** `SiteFooter()` server component, rendered by every page below main content (Phases 3–6 add it to each page they touch). `MobileNav({ session })` client component rendered inside `SiteHeader`; uses `<dialog>` + `showModal()` for native focus trap; closes on `Esc` and on link click; trigger button `aria-expanded` + `aria-controls="mobile-nav"`, visible only below `md:`.

- [ ] **Step 1: Write failing e2e** in `e2e/shell.spec.ts`: at 375×812 viewport the hamburger is visible, opens the drawer (`role=dialog`), first focus lands inside, `Esc` closes it, drawer links navigate to `/courts`; footer exists on `/`, `/courts`, `/coaches` with links to `/about`, `/terms`, `/privacy` (these 404 until Phase 6 — assert `href` presence only, not navigation); visiting `/definitely-missing` renders the custom 404 heading "Out of bounds".
- [ ] **Step 2: Implement.** Header: keep 3-column grid, restyle with tokens (`bg-white/90 backdrop-blur border-b border-sand-200`), active-route lime underline via `usePathname` in a small client `NavLinks` component, hamburger below `md:`. Footer: `bg-court-950 text-sand-100`, 4 columns (Product / Company / Legal / brand with `CourtLines variant="corner"` + payment badges "GCash · Maya · QR Ph · Bank transfer" as plain text pills), collapses to accordion-free stacked columns on mobile. 404: `CourtLines variant="field"` + heading "Out of bounds" + Button href="/" "Back to the court". error.tsx: heading "Something went wrong", body names the failed action generically, retry Button calling `reset()`. loading.tsx files: `Skeleton` grids mirroring each page's layout.
- [ ] **Step 3: Screenshot harness.** In `playwright.config.ts` add `expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.02 } }`. In `e2e/visual.spec.ts` snapshot `/`, `/courts`, `/coaches`, `/login` at 375×812 and 1280×800 (`page.goto` → `await expect(page).toHaveScreenshot(\`landing-375.png\`, { fullPage: true })` etc.). Generate baselines: `pnpm --filter @courtlink/web test:e2e -- --update-snapshots`; commit the `visual.spec.ts-snapshots/` directory. Write `e2e/README.md`: when a phase intentionally changes appearance, re-run with `--update-snapshots` in the same commit and say so in the commit message; never update snapshots to make an unrelated phase pass.
- [ ] **Step 4: Update `site-header.test.tsx`** for the new markup (nav links still render; brand link present; hamburger button present).
- [ ] **Step 5: Gate, commit + push:** `pnpm check`, `pnpm --filter @courtlink/web test:e2e`. Commit `"feat(web): responsive app shell with mobile drawer, footer, system pages, visual regression harness"`. Update `PAUSE.md`.

### Phase 3: Landing page rebuild

**Files:**
- Create: `apps/api/src/discovery/public-stats.controller.ts` (+ service method + tests beside existing discovery module files — follow that module's structure)
- Modify: `apps/web/app/page.tsx` (full rebuild)
- Create: `apps/web/components/landing/hero-search.tsx` (client), `how-it-works.tsx`, `faq.tsx`, `proof-strip.tsx`, `featured-venues.tsx`, `coaches-band.tsx`, `trust-section.tsx`, `cta-band.tsx`
- Modify: `apps/web/lib/api.ts` (add `PublicStats` type + fetcher)
- Modify: `apps/web/e2e/public-pages.spec.ts`, regenerate `visual.spec.ts` landing snapshots

**Interfaces:** `GET /api/v1/stats/public` → `{ venues: number; cities: number; coaches: number }` (approved venues, distinct cityMunicipality of approved venues, published coaches). No auth. Cached in the web layer via `fetch` revalidate 300.

- [ ] **Step 1 (API, TDD):** failing unit test for the stats service method (counts only APPROVED venues / published coaches — follow the discovery module's existing test style), then controller test for the route shape. Implement with three Prisma counts in one `Promise.all`. Run `pnpm --filter @courtlink/api test`.
- [ ] **Step 2 (Web):** rebuild `page.tsx` in the spec's section order: hero (CourtLines field background at 8% opacity, display headline, working `HeroSearch` posting city/date/durationMin to `/courts`), proof strip (hide raw counts below 3 venues → show "Growing across the Philippines · new venues weekly"), How-it-works tabs (accessible tablist, arrow-key navigation, Players / Venue owners & coaches), featured venues (server fetch of `/venues?limit=6`, hidden when empty), coaches band, trust section (copy from spec §Landing 6), FAQ (`<details>` accordions, 6 questions from spec), CTA band, `SiteFooter`. Staggered hero reveal with CSS `@keyframes` + `animation-delay`, wrapped in `@media (prefers-reduced-motion: no-preference)`.
- [ ] **Step 3: e2e:** extend `public-pages.spec.ts` — hero search with city "Cebu City" navigates to `/courts?city=Cebu+City&...`; FAQ accordion opens; tabs switch panels with keyboard; axe still green on `/`.
- [ ] **Step 4:** regenerate landing visual snapshots (`--update-snapshots`), gate, commit `"feat: rebuild landing page with live stats, working search, trust sections"`, push, update `PAUSE.md`.

### Phase 4: Discovery and detail pages

**Files:**
- Modify: `apps/web/app/courts/page.tsx`, `apps/web/app/courts/[slug]/page.tsx`, `apps/web/app/coaches/page.tsx`, `apps/web/app/coaches/[id]/page.tsx`
- Create: `apps/web/components/discovery/filter-bar.tsx` (client: sticky bar, mobile sheet via `<dialog>`, active-filter chips with remove buttons), `venue-card.tsx`, `coach-card.tsx`, `cover-placeholder.tsx` (gradient + CourtLines, deterministic hue rotation from venue slug hash)
- Test: `apps/web/components/discovery/filter-bar.test.tsx`
- Modify: `apps/web/e2e/public-pages.spec.ts`, visual snapshots

- [ ] **Step 1:** failing unit test for `FilterBar` (renders chip per active filter from `searchParams`-shaped props; chip remove produces URL without that key — assert via `buildFilterHref` pure helper it exports).
- [ ] **Step 2:** implement FilterBar + cards; results header shows count ("N venues"); EmptyState replaces bare paragraph; venue cards use `CoverPlaceholder` (photo slot API arrives Phase 8), price bottom-left, `RatingBadge` top-right, amenity pills with "+n more". Migrate both list pages and both detail pages to primitives; venue detail gets hero block + sticky desktop booking summary (pure layout — booking logic untouched); delete now-unused legacy CSS blocks (`/* Discovery */`, `/* Courts */` card styles, `/* Coaches */`, coach profile block).
- [ ] **Step 3:** e2e: applying a city filter shows a removable chip and filtered results; removing the chip restores; venue detail axe check added (seeded venue slug from demo seed — read seed for a stable slug); coaches detail axe check.
- [ ] **Step 4:** regenerate courts/coaches snapshots, gate, commit `"feat(web): redesign discovery and detail pages with filter bar and card system"`, push, update `PAUSE.md`.

### Phase 5: Booking flows and workspaces

**Files:**
- Create: `apps/web/components/ui/toast.tsx` (`ToastProvider` + `useToast()`; renders `role="status"` stack, auto-dismiss 5s, pause on hover) + tests in `ui.test.tsx`
- Create: `apps/web/components/ui/countdown.tsx` (`<Countdown until={iso} />` → "3:42", `aria-live="off"`, updates 1s) + test with fake timers
- Modify: `apps/web/app/layout.tsx` (mount ToastProvider)
- Modify: `apps/web/components/court-booking.tsx`, `booking-list.tsx`, `venue-queue.tsx`, `coach-workspace.tsx`, `player-coaching.tsx`, `moderation-queue.tsx`, `admin-venue-queue.tsx`, `auth-form.tsx`, `notification-list.tsx`, `review-form.tsx` (presentation + feedback only — no API/behavior changes)
- Modify: `apps/web/app/dashboard/page.tsx`, `manage/page.tsx`, `coach/page.tsx`, `admin/**`, `notifications/page.tsx`, `login/page.tsx`, `register/page.tsx`
- Modify: existing component tests where they assert legacy class names

- [ ] **Step 1 (TDD):** failing tests for Toast (useToast pushes message rendered in `role="status"`; auto-dismiss with fake timers) and Countdown (renders mm:ss for a fixed future date with mocked `Date.now`).
- [ ] **Step 2:** implement Toast + Countdown; convert action feedback (proof submit/approve/reject, cancellations, offer accept, amenity save) to toasts using verbs matching their buttons ("Proof submitted." after "Submit proof"). Replace every ad-hoc status span with `StatusPill`. Add `Countdown` to HELD bookings ("Proof due in 3:42"). Auth forms: password visibility toggle (`aria-pressed`), `Button loading` during submit, errors via `Field error`.
- [ ] **Step 3:** migrate the listed pages/components to primitives; delete their legacy CSS blocks. Keep every existing test green — update assertions that referenced old markup in the same commit.
- [ ] **Step 4:** e2e: login form shows validation error for bad credentials (existing dev API), password toggle flips input type; dashboard axe check with demo player session (see `e2e/README.md` — document a `loginAs(page, "player@demo.courtlink.ph")` helper in `e2e/helpers.ts`).
- [ ] **Step 5:** gate, regenerate affected snapshots, commit `"feat(web): redesign booking flows and workspaces with toasts, countdowns, status pills"`, push, update `PAUSE.md`.

### Phase 6: Trust pages and SEO

**Files:**
- Create: `apps/web/app/about/page.tsx`, `contact/page.tsx`, `faq/page.tsx`, `terms/page.tsx`, `privacy/page.tsx` (static content pages, shared `ContentPage` layout component in `apps/web/components/content-page.tsx`)
- Create: `apps/web/app/sitemap.ts`, `apps/web/app/robots.ts`, `apps/web/app/opengraph-image.tsx` (next/og, court-line motif + wordmark)
- Create: `apps/web/lib/site.ts` (`SITE_URL` from env, default `http://localhost:3000`; `absoluteUrl(path)`)
- Create: `apps/web/lib/jsonld.ts` (`venueJsonLd(venue)`, `coachJsonLd(coach)`, `organizationJsonLd()` returning objects; rendered via `<script type="application/ld+json">`)
- Modify: `apps/web/app/layout.tsx` (metadata: title template `"%s — CourtLink PH"`, OG defaults), venue + coach detail pages (`generateMetadata` + JSON-LD), `.env.example` (+`SITE_URL`), `apps/web/manifest.ts` (categories, maskable icon)
- Test: `apps/web/lib/jsonld.test.ts`, `apps/web/lib/site.test.ts`; extend `e2e/public-pages.spec.ts`

- [ ] **Step 1 (TDD):** failing unit tests: `absoluteUrl("/courts")` joins without double slash; `venueJsonLd` outputs `@type: "SportsActivityLocation"`, name, address locality, `aggregateRating` only when reviews exist.
- [ ] **Step 2:** implement lib + pages. Content for about/terms/privacy/faq: write plainly from the spec's §Trust bullets and the product's actual behavior (direct payments, proof privacy/encryption, AGPL, moderation). Terms/privacy carry an honest preamble that they describe platform behavior and are not legal advice.
- [ ] **Step 3:** sitemap pulls approved venue slugs + coach ids from the API with `try/catch []` fallback; robots allows all, points at sitemap; footer links from Phase 2 now resolve — update `shell.spec.ts` to actually navigate them; axe suite adds the five new routes.
- [ ] **Step 4:** verify OG image renders: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/opengraph-image` → 200.
- [ ] **Step 5:** gate, commit `"feat(web): trust pages, sitemap, robots, structured data, og images"`, push, update `PAUSE.md`.

### Phase 7: Legacy CSS retirement

**Files:**
- Modify: `apps/web/app/globals.css`, any straggler pages/components still on legacy classes (`offline/page.tsx`, promotion components, operations components, schedule manager)

- [ ] **Step 1:** `grep -o 'className="[^"]*"' -r apps/web/app apps/web/components | ...` — inventory remaining legacy class usage; migrate each remaining consumer to primitives/utilities (this includes `court-schedule-manager.tsx`, `operations-status.tsx`, `promotion-*.tsx`, `notification-bell.tsx`, `favorite-toggle.tsx`, `report-button.tsx`, `rating-badge.tsx`).
- [ ] **Step 2:** reduce `globals.css` to: tailwind import, `@theme`, base element rules (html/body/a/h1/h2/sr-only), status-pill tone utilities, hero/court-line keyframes, reduced-motion block. Target < 250 lines. Any legacy selector still referenced is a Step 1 failure — go back.
- [ ] **Step 3:** full gate + full visual snapshot regeneration (expected: zero or near-zero diffs — this phase must NOT change appearance; investigate any diff before updating). Commit `"refactor(web): retire legacy stylesheet in favor of token utilities"`, push, update `PAUSE.md`.

### Phase 8: Venue photos

**Files:**
- Modify: `packages/database/prisma/schema.prisma` (+`VenuePhoto` model per spec §Venue photos, relation on Venue, `@@unique([venueId, position])`)
- Create: migration `packages/database/prisma/migrations/<ts>_venue_photos/migration.sql`
- Create: `apps/api/src/venues/venue-photos.service.ts` + `.test.ts`, `venue-photos.controller.ts` + `.test.ts` (follow the proof-upload module's re-encoding pipeline; max 8 photos, 5MB, jpeg/png/webp in → re-encoded webp out; alt text required, 5–200 chars)
- Create: `apps/api/integration/venue-photos.test.ts`
- Modify: discovery + venue detail API responses (`coverPhotoUrl`, `photos[]` on detail)
- Create: `apps/web/components/manage/venue-photo-manager.tsx` (+ test) — upload, reorder (position swap buttons, no drag dependency), delete, alt-text edit
- Modify: `apps/web/app/manage/page.tsx`, venue cards/detail to prefer real photos over `CoverPlaceholder` via `next/image` (remote pattern for API host in `next.config.ts`)

**Interfaces:** `POST /api/v1/venues/:venueId/photos` (multipart `file`, `altText`) → photo json; `PATCH /api/v1/venues/:venueId/photos/:photoId` (`{ altText?, position? }`); `DELETE .../:photoId`; public `GET /api/v1/venue-photos/:photoId` → 302 to signed URL, `Cache-Control: public, max-age=86400`. Tenant authorization on all mutations (owner/manager of the venue's business).

- [ ] **Step 1 (TDD):** failing service tests — photo cap (9th upload rejected), alt-text validation, tenant denial for non-members, position uniqueness swap, public URL redirect for approved venues only.
- [ ] **Step 2:** schema + migration + implement service/controller reusing the proof re-encode + storage adapters. Integration test with the database (`pnpm test:integration` group).
- [ ] **Step 3:** web manager UI + wiring cards/detail with `next/image` (explicit `sizes`, `alt` from stored altText).
- [ ] **Step 4:** e2e (needs owner login helper): upload → cover appears on `/courts` card. Update OpenAPI docs (Swagger decorators as in neighboring controllers). Gate + integration suite, commit `"feat: venue photo galleries with safe re-encoding and public covers"`, push, update `PAUSE.md`.

### Phase 9: Dark mode and motion polish

**Files:**
- Modify: `apps/web/app/globals.css` (dark token overrides), `apps/web/app/layout.tsx` (pre-paint inline theme script)
- Create: `apps/web/components/theme-toggle.tsx` + test (three-way light/dark/system; persists `courtlink-theme` in localStorage; sets `data-theme` on `<html>`)
- Modify: `apps/web/components/site-header.tsx`, `mobile-nav.tsx` (mount toggle)
- Modify: `apps/web/e2e/` (axe both themes; toggle persistence test), visual snapshots for dark landing + courts

- [ ] **Step 1:** define dark overrides under `[data-theme="dark"]` (and `@custom-variant dark ([data-theme="dark"] &);` for `dark:` utilities): surfaces from `court-950`→`#0f1713` ramp, text `sand-100`, borders `#243a2e`, semantic tone pairs re-checked to AA (document contrast ratios in the commit message or a comment).
- [ ] **Step 2 (TDD):** ThemeToggle unit test (cycles value, writes localStorage, sets `data-theme`); inline script in layout reads localStorage/`prefers-color-scheme` before paint (`dangerouslySetInnerHTML`, < 15 lines).
- [ ] **Step 3:** finalize landing reveal + hover micro-interactions; verify reduced-motion disables all of it (e2e: emulate `reducedMotion: "reduce"`, assert no animation styles).
- [ ] **Step 4:** e2e: axe suite parameterized over both themes; toggle persists across reload. Add dark visual snapshots. Gate, commit `"feat(web): dark mode with pre-paint theme script and motion polish"`, push, update `PAUSE.md`.

### Phase 10: Performance audit, optional map view, final report

**Files:**
- Create: `docs/verification/2026-XX-XX-web-redesign-audit.md`
- Optional: `apps/web/components/discovery/venue-map.tsx` (dynamic import, Leaflet + OSM tiles, markers from lat/lng, list/map toggle on `/courts`)

- [ ] **Step 1:** production build (`pnpm build`), run `npx lighthouse http://localhost:3000 --preset=perf --form-factor=mobile` (and `/courts`) against `next start`; record scores; fix regressions until performance ≥ 90 mobile (typical fixes: font preload, image sizes, third-party-free landing).
- [ ] **Step 2 (optional, only if Steps 1 is done and stable):** map toggle with `leaflet` + `react-leaflet` behind `next/dynamic` (`ssr: false`); markers only for venues with coordinates; keyboard-accessible fallback list always present; axe on map view.
- [ ] **Step 3:** write the audit doc: what shipped per phase, gate results, Lighthouse numbers, axe status, snapshot inventory, known gaps. Update `README.md` features/tech table (screenshots section optional), refresh `PAUSE.md` to point at the audit. Commit `"docs: web redesign audit and readme refresh"` (+ `"feat(web): optional map view"` separately if built), push.

---

## Self-review notes

- Spec coverage: design language→P1, shell→P2, landing→P3, discovery→P4, booking/workspaces→P5, trust/SEO→P6, migration completion→P7, photos→P8, dark/motion→P9, perf/map/report→P10. Working agreements are in Global Constraints.
- Phase numbering matches the spec's cross-references (photos=8, dark=9, map/perf=10).
- Primitive APIs defined once in Phase 1 and consumed by name afterward; StatusPill tones and Toast/Countdown signatures are pinned where they're created.
