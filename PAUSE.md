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
- Branch: `main` (marketplace feature-complete; see previous checkpoint below).
- Active effort: **web experience redesign** — spec and 10-phase plan committed 2026-07-02.
- Phase status: Phase 1 (design system foundation) complete — tokens, Bricolage Grotesque
  display font, `components/ui/` primitives with 24 unit tests. Next: Phase 2 (app shell).
- Environment notes: root `node_modules` had a corrupt pnpm link tree (missing `tslib` under
  `@nestjs/core`) — fixed by full reinstall. `biome.json` now excludes `.worktrees`/`static`
  and enables `css.parser.tailwindDirectives`. Playwright Chromium reinstalled.
- Root checkout has unrelated untracked `config.yaml` and `static/` — do not touch.
- The `.worktrees/foundation` worktree is from the completed foundation effort; redesign work
  happens directly on `main` in the root checkout.

## Prior effort (complete)

The marketplace is feature-complete: auth (email + Google OAuth), courts (inventory, discovery,
holds, proof review, refunds), coaches (profiles, offers, atomic winner), web workspaces,
notifications, email, operations, Docker/Caddy production stack, 240+ unit tests, 83 integration
tests, Playwright + axe e2e scaffold.

Known operational items (not blockers): CI dependency/container scans, live Google OAuth
verification, clean Oracle VM deployment.

## Local commands

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
