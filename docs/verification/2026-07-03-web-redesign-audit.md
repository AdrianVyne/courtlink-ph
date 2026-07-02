# Web experience redesign — final audit (2026-07-03)

Closes out the 10-phase plan in
[`docs/superpowers/plans/2026-07-02-web-experience-redesign.md`](../superpowers/plans/2026-07-02-web-experience-redesign.md)
against the spec in
[`docs/superpowers/specs/2026-07-02-web-experience-redesign-design.md`](../superpowers/specs/2026-07-02-web-experience-redesign-design.md).
Direction: "Court Modern" — light-first, court-green + lime, Bricolage Grotesque display face,
pickleball court-line SVG as the signature motif.

## What shipped, by phase

| Phase | Shipped |
|---|---|
| 1 | `@theme` token system (court/sand/ink/lime ramps, semantic tones, radii, float shadow), Bricolage Grotesque display font, `components/ui/` primitive library (24 unit tests) |
| 2 | Responsive header + focus-managed mobile drawer, footer, custom 404/error/loading pages, visual snapshot harness (`apps/web/e2e/__screenshots__/`) |
| 3 | Landing rebuild: hero with working search, live stats strip (`GET /api/v1/stats/public`), how-it-works tabs, featured venues, coaches band, trust section, FAQ, CTA band |
| 4 | Discovery redesign: FilterBar with removable chips + mobile filter sheet, VenueCard/CoachCard/CoverPlaceholder, venue + coach detail migration, legacy discovery CSS removed |
| 5 | Toast + Countdown primitives, StatusPill everywhere, all five workspaces on WorkspaceShell, auth pages with password toggle and loading buttons |
| 6 | Trust pages (/about /contact /faq /terms /privacy), JSON-LD (venue/coach/organization), metadata templates + OG image route, sitemap/robots, `SITE_URL` config |
| 7 | Legacy stylesheet retired: `globals.css` 961 → ~110 lines, every component on token utilities, zero visual diffs |
| 8 | Venue photos end to end: webp re-encoding upload pipeline (8-photo cap, alt text required, tenant-guarded), public 302 photo URLs, discovery covers + detail gallery, manager UI on /manage, integration + e2e coverage |
| 9 | Dark mode via `[data-theme="dark"]` palette remap (AA-checked, ratios documented in `globals.css`), lime primary actions in dark, ThemeToggle (system/light/dark) with pre-paint script, motion-safe card hover lift, axe suite across both themes, dark visual baselines |
| 10 | Production Lighthouse audit + LCP fix (hero headline rises without fading), this document, README refresh |

## Gate results (final session, 2026-07-03)

- `pnpm check`: 18/18 turbo tasks green (format, lint, typecheck, unit tests, production builds).
- Functional e2e (`auth`, `public-pages`, `shell`, `venue-photos`): **54/54** against the seeded
  local API — includes theme persistence, pre-paint dark application, reduced-motion assertion,
  and the owner photo-upload flow.
- Visual regression: **12/12** baselines match (see inventory below).
- Integration suites (`pnpm test:integration`, 8 task groups): API 54, web 68, worker 3,
  backup 7 — all green. A pre-existing race in `public-stats.test.ts` was fixed during Phase 8
  verification (both reads now share one `RepeatableRead` snapshot).
- CI on `main`: `CI`/`verify` and `Docker images` workflows green through commit `3cff3ea`.

## Lighthouse (mobile, performance preset)

Measured 2026-07-03 against `next start` (production build) with the API running locally,
headless Chrome, Lighthouse via `npx lighthouse --preset=perf --form-factor=mobile`.

| Page | Performance | FCP | LCP | TBT | CLS | Speed Index |
|---|---|---|---|---|---|---|
| `/` (landing) | **95** | 2.2 s | 2.2 s | 130 ms | 0.001 | 2.3 s |
| `/courts` | **98** | 1.9 s | 1.9 s | 100 ms | 0 | 1.9 s |

The landing page initially scored 89: the hero headline (the LCP element) faded in from
`opacity: 0` with a 90 ms stagger, pushing LCP to 3.1 s. The headline now rises solid
(`.reveal-solid`, transform-only) while the rest of the hero keeps the staggered fade — LCP
dropped to 2.2 s. Both pages meet the ≥ 90 budget from the spec.

Numbers are from a local loopback server on a developer machine; treat them as an upper bound
and re-measure after deployment.

## Accessibility

- axe (WCAG 2.2 A/AA/22AA tags) is green on all 10 public routes **in both light and dark**
  (20 checks), plus the player dashboard with a live session.
- Focus is visible everywhere: court-700 outline on light, lime on dark.
- Mobile drawer and filter sheet are native `<dialog>`s — focus-trapped, `Esc`-dismissable.
- Every animation and hover transform is gated behind `prefers-reduced-motion` (asserted in e2e
  by emulating `reducedMotion: "reduce"`).
- Dark palette contrast ratios are documented in the `globals.css` theme comment (all pairs
  ≥ 4.5:1 for text; most are 7:1+).

## Visual snapshot inventory

`apps/web/e2e/__screenshots__/visual.spec.ts/`, rendered on Windows, compared with
`maxDiffPixelRatio: 0.02`, skipped on CI (Linux font rasterization differs — run locally):

- Light, 375 px + 1280 px: `landing`, `courts`, `coaches`, `login` (8 files)
- Dark, 375 px + 1280 px: `landing-dark`, `courts-dark` (4 files)

`e2e/screenshot.css` (applied via `stylePath`) keeps the Next dev overlay out of baselines.

## Known gaps and notes

- **Map view (Phase 10 Step 2, optional) was deliberately not built.** Discovery remains
  list-only; venues carry no coordinates yet. If wanted later: Leaflet + OSM behind
  `next/dynamic`, keyboard-accessible list always present.
- Dark visual baselines cover landing + courts only (the two highest-traffic public pages);
  the axe suite covers all routes in dark.
- Visual baselines are Windows-rendered and excluded from CI; the 2 % diff ratio can mask
  small regressions (it hid a stale-header baseline during Phase 9 — see PAUSE.md gotcha about
  wiping `apps/web/.next` when the persistent dev cache serves stale SSR).
- Lighthouse was not run for dark mode separately; the theme script is inline and adds no
  network cost.
- Pre-existing operational items (live Google OAuth verification, Oracle VM deployment) are
  unchanged from the prior effort and tracked in PAUSE.md.
