# Web e2e suite

Playwright specs guarding the public experience. Run from `apps/web`:

```bash
pnpm test:e2e                 # full suite; dev server auto-starts on :3000
pnpm playwright test e2e/visual.spec.ts --update-snapshots   # refresh baselines
```

## Files

- `public-pages.spec.ts` — smoke + axe (WCAG 2.2 AA) checks for every public route.
- `shell.spec.ts` — app shell behavior: mobile drawer (open/focus/Escape/navigate),
  footer links, custom 404.
- `visual.spec.ts` — screenshot regression for key pages at 375px and 1280px.
  Baselines are committed under `e2e/__screenshots__/`.

## Rules

- Every phase of the redesign plan extends this suite; a phase is not committed
  while any spec fails.
- Visual baselines change only when a commit intentionally changes appearance.
  Regenerate with `--update-snapshots` in that same commit and mention it in the
  commit message. Never refresh baselines to make an unrelated change pass.
- Screenshot tests assume the API is not running (empty discovery states) or is
  seeded with the standard demo seed. Mixing states will produce diffs.
- Data-dependent specs (dashboard flows) use the demo accounts from
  `packages/database` seed: `player@demo.courtlink.ph` etc., password
  `courtlink-demo-2026`.
