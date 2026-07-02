# CourtLink PH Web Experience Redesign

Date: 2026-07-02. Status: approved for implementation.
Companion plan: `docs/superpowers/plans/2026-07-02-web-experience-redesign.md`.

## Purpose

CourtLink PH is functionally complete but visually minimal. The current web client is a single
1,500-line hand-rolled `globals.css`, a landing page with one hero and three feature cards, no
footer, no mobile navigation (the nav is hidden below 800px), no imagery, no loading or error
states, and no trust/legal pages. It works, but it does not look like a product people would
trust with GCash payments.

This redesign makes the site look professionally built and contemporary, and improves
conversion: a visitor should understand what CourtLink does within five seconds, trust it enough
to register, and reach a bookable court in two clicks. Every phase ships independently, passes
the full quality gate, and adds regression tests so later phases cannot silently break earlier
ones.

## Design language

**Direction: "Court Modern."** Light-first (per product spec), warm, athletic, precise. The
signature motif is **pickleball court line geometry** — the kitchen line, sidelines, and service
boxes — used as structural graphics: hero background line-work, section dividers, card corner
accents, and the 404 page. This is drawn as inline SVG (license-clean, zero network cost) and is
the one visual element the site should be remembered by. Everything else stays quiet and
disciplined.

**Color tokens** (defined once in Tailwind 4 `@theme`, consumed as utilities):

| Token | Value | Role |
|---|---|---|
| `court-950` | `#0d2b1c` | Darkest ink on brand surfaces, footer background |
| `court-700` | `#1b5e3f` | Primary brand green (evolved from `#236b48`) |
| `court-600` | `#236b48` | Hover/active brand, legacy brand anchor |
| `court-100` | `#e3efe7` | Tinted surfaces, icon chips |
| `lime-400` | `#d8f36b` | Energy accent: eyebrows, highlights, focus marks (evolved from `#dff77f`) |
| `sand-50` | `#faf9f6` | Page background (warm, replaces cool `#f4f7f4`) |
| `sand-200` | `#e8e4da` | Hairlines and borders |
| `ink-900` | `#1a201c` | Body text |
| `ink-500` | `#5f6a63` | Muted text |

Status colors (success/pending/danger/info) become semantic tokens with AA-checked pairs,
replacing today's ad-hoc hex values. The full scale (50–950 per hue) is generated in the theme;
the table above lists the anchors.

**Typography.** Display: **Bricolage Grotesque** (Google Fonts via `next/font`, variable) for
h1/h2 and stat numerals — characterful, contemporary, sporty without being novelty. Body/UI:
**Geist** (already installed). Times and prices use tabular numerals (`font-feature-settings:
"tnum"`). Type scale: 12/14/16/18/22/28/36/52/72 with tight letter-spacing above 36px.

**Shape and depth.** Radius 12px cards / 10px controls / 999px pills. Borders are `sand-200`
hairlines; shadows are rare, tinted green, and reserved for floating elements (dropdowns, sticky
availability bar). No glassmorphism, no gradient meshes.

**Motion.** Small and purposeful: 150–200ms ease-out on hover/focus, one orchestrated page-load
reveal on the landing hero (staggered fade-up), scroll-triggered section reveals at most once per
section. Everything gated behind `prefers-reduced-motion`.

**Voice.** Sentence case everywhere. Buttons say what they do ("Book this court", "Post a
request"). Errors say what happened and what to do next. Empty states invite action. No
exclamation marks in UI chrome.

## Architecture decision: Tailwind utilities + tokens

Tailwind CSS 4 is already installed but unused. All new and touched UI moves to utility classes
driven by `@theme` tokens in `globals.css`. Legacy class-based CSS remains during migration and
is deleted page-by-page as pages are rebuilt; the redesign is complete when `globals.css`
contains only `@import "tailwindcss"`, the `@theme` block, and a small set of `@utility`/
component-layer rules (status pills, court-line motif helpers). No component library dependency
is added: primitives are hand-built on native elements (`<dialog>`, `popover`, `<details>`)
with explicit ARIA, which keeps the bundle small and the axe gate meaningful.

Shared primitives live in `apps/web/components/ui/`: `Button`, `Card`, `Badge`, `StatusPill`,
`Input`, `Select`, `Field`, `EmptyState`, `Skeleton`, `Dialog`, `Toast`, `Tabs`, `Avatar`,
`Stat`, `CourtLines` (the SVG motif). Each has a Vitest unit test covering render, variants, and
a11y attributes.

## App shell

- **Header:** current three-column layout kept, restyled. Below 800px a hamburger opens a
  full-height slide-in drawer (focus-trapped, `<dialog>`-based) with primary nav, auth actions,
  and notification link. Active route gets a lime underline mark.
- **Footer (new):** four columns on `court-950` — product links (Courts, Coaches, Coaching
  requests), company (About, Contact, FAQ), legal (Terms, Privacy), and a brand column with the
  court-line motif and "Built for Filipino pickleball" line. Payment-method trust row (GCash,
  Maya, QR Ph, bank transfer as text badges — no trademarked logos).
- **System pages (new):** `not-found.tsx` (court-line 404 illustration), global `error.tsx`
  (apology-free retry), per-route `loading.tsx` skeletons for courts, coaches, dashboard, and
  detail pages.

## Landing page

Section order, all real content (no lorem, no fake testimonials):

1. **Hero.** Court-line SVG field as background texture. Display headline ("Your next game is
   already out there." — final copy at implementation), subline, two CTAs. The availability card
   becomes a **working search bar**: city input + date + duration submitting to `/courts` with
   query params. Staggered load reveal.
2. **Live proof strip.** Real counts from the API (approved venues, cities covered, verified
   coaches) rendered as `Stat` primitives with Bricolage numerals. Server-rendered with 5-minute
   revalidation; hidden gracefully when counts are too small to impress (below 3 venues the
   strip shows cities + "growing weekly" instead of raw counts — honest, not inflated).
3. **How it works.** Two tab panes (Players / Venue owners & coaches), three steps each, using
   real product behavior (search → hold → pay direct with proof → play; list → approve → get
   booked). Steps are a genuine sequence, so numbered markers are justified here.
4. **Featured venues.** Up to six real venue cards from discovery API (newest approved),
   linking into detail pages. Section hidden entirely when the API returns none.
5. **Coaches band.** Compact horizontal strip: coach value proposition + up to four coach cards
   + "Post an open request" CTA.
6. **Trust section.** Plain-language explanation of direct payments with proof review, privacy
   of proof images, and review-gated ratings. This is where skeptical Filipino users decide;
   copy is specific ("You pay the venue directly over GCash — CourtLink never holds your
   money.").
7. **FAQ.** Six questions via accessible `<details>` accordions (booking holds, refund windows,
   coach verification, payment safety, listing a venue, PWA install).
8. **Final CTA band** on `court-700` with lime accent, then the footer.

## Discovery and detail

- **Courts list:** filter form becomes a sticky, horizontally compact bar on desktop and a
  collapsible "Filters" sheet on mobile; active filters render as removable chips; result count
  shown ("14 venues"). Venue cards get a cover-image slot (court-line placeholder gradient until
  Phase 8 delivers real photos), price anchored bottom-left, rating badge top-right, amenity
  pills truncated with "+n more".
- **Venue detail:** hero block (name, location with map pin, rating, favorite, report), photo
  gallery slot, courts + availability section restyled with the slot-grid as proper time-pill
  buttons, sticky booking summary on desktop.
- **Coaches list/detail:** same card system; verified badge uses semantic token; detail page
  gets availability list and reviews restyled with primitives.
- **Map view (stretch, Phase 10):** optional Leaflet + OpenStreetMap toggle on `/courts`
  using existing lat/lng. Free, no API key. Ships only if list experience is done and stable.

## Booking and workspaces

Player dashboard, venue queue, coach workspace, and admin pages move to the primitive system:
booking rows become cards with clear status pills (one shared `StatusPill` mapping all statuses
to the semantic tokens), countdown display for active holds ("Proof due in 3:42"), and toast
feedback (`Toast` primitive) replacing bare inline text for actions like proof approval or
cancellation. Forms gain: loading buttons (spinner + disabled during submit), password
visibility toggles, and inline validation messages tied via `aria-describedby`. No behavioral
API changes in these phases — presentation and feedback only.

## Trust, content, and SEO

- **New public pages:** `/about` (mission, how the marketplace sustains itself, AGPL openness),
  `/contact` (email + report abuse pointers), `/faq` (expanded from landing FAQ), `/terms`,
  `/privacy` (both written plainly, covering direct payments, proof-image handling, encryption,
  retention, and moderation — grounded in what the system actually does; reviewed as honest
  descriptions, not legal boilerplate pretending to be counsel).
- **SEO:** per-page `generateMetadata` (title template "… — CourtLink PH", descriptions),
  Open Graph + Twitter cards with a dynamic OG image via `next/og` (ImageResponse) using the
  court-line motif; `sitemap.ts` (static routes + approved venue and coach slugs);
  `robots.ts`; JSON-LD (`SportsActivityLocation` on venue pages, `Person`+`Service` on coach
  pages, `Organization` + `WebSite` on the root); canonical URLs from a `SITE_URL` env.
- **PWA polish:** maskable icon variants, richer manifest (categories, screenshots later).

## Venue photos (new feature, Phase 8)

Schema: `VenuePhoto { id, venueId, objectKey, altText, position, createdAt }` (max 8 per
venue). Reuses the existing private-object-storage + safe re-encoding pipeline from payment
proofs, but photos are **public-read via long-lived CDN-style URLs** (unlike proofs) — served
through an API endpoint that streams or redirects to signed URLs cached aggressively. Venue
managers upload/reorder/delete in the manage workspace with alt-text required (a11y + SEO).
Discovery and detail pages consume position-0 as cover. Placeholder gradient + court-line motif
renders whenever a venue has no photos, so the design never depends on upload adoption.

## Dark mode and motion polish (Phase 9)

Class-based dark variant (`data-theme`) with a three-way toggle (light/dark/system) persisted in
`localStorage` and read pre-paint via inline script to avoid flash. Dark surfaces derive from
`court-950`/warm ink, not pure black; lime accent persists. Every semantic token gets a dark
counterpart checked to AA. The axe e2e suite runs both themes. Landing reveal animation and
micro-interactions are finalized here, all reduced-motion gated.

## Accessibility and performance budgets

- WCAG 2.2 AA maintained; axe e2e must stay green on every public page, both themes.
- Focus visible everywhere (lime double-ring on dark, court-700 ring on light).
- Touch targets ≥ 44px; the mobile drawer and dialogs are focus-trapped and `Esc`-dismissable.
- Performance: LCP element on landing is the headline (no hero image dependency), fonts loaded
  via `next/font` (self-hosted, `display: swap` for the display face), all images through
  `next/image` with explicit sizes. Budget: Lighthouse performance ≥ 90 mobile on landing and
  courts list against a local production build; verified in Phase 10 and recorded in
  `docs/verification/`.

## Testing and regression strategy

The user's explicit requirement: new features must not regress existing ones, and the suite
must live in the repo.

- **Unit (Vitest):** every `components/ui/*` primitive gets a test; existing component tests
  keep passing untouched (they assert behavior, not classes — where a test asserts a legacy
  class name it is updated in the same phase that restyles the component).
- **E2E (Playwright, `apps/web/e2e/`):** `public-pages.spec.ts` grows with each phase —
  navigation smoke (mobile drawer opens/closes/traps focus, footer links resolve, 404 renders),
  landing sections render with live data or hide gracefully, filters produce chips and results,
  auth form validation, theme toggle persists. Axe suite extends to every new public route and
  both themes.
- **Visual regression:** Playwright `toHaveScreenshot` on five key pages (landing, courts,
  venue detail, coaches, login) at 375px and 1280px, snapshots committed under
  `apps/web/e2e/__screenshots__/`, refreshed deliberately when a phase intentionally changes
  appearance (`--update-snapshots`), documented in `apps/web/e2e/README.md`. This is the
  concrete "don't break what exists" net for a visual project.
- **Gate:** every phase ends with `pnpm check` (format, lint, typecheck, unit, build) plus
  `pnpm --filter @courtlink/web test:e2e`; a phase is not committed until both pass.

## Out of scope

Native apps, SMS, online payment collection/commission, i18n/Tagalog localization (copy stays
English as today), CMS, analytics/tracking scripts (a privacy-respecting counter may be
considered later), venue video, and any API behavior change outside the venue-photos feature.

## Working agreements for this effort

Per the repository owner: commits use plain descriptive messages **without co-author trailers**,
are pushed to `origin main` after each verified phase, and each phase updates `PAUSE.md` so any
future session (or human) can resume from the plan without chat history.
