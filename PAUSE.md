# CourtLink PH Pause / Resume Handoff

Last updated: 2026-06-23 (Asia/Manila)

## Resume prompt

> Resume CourtLink PH from `PAUSE.md`. Read `AGENTS.md`, the design spec, and the implementation plan. Inspect the current Git/worktree state. Work in `.worktrees/foundation` on `feat/foundation`. Update `PAUSE.md` before stopping.

## Current checkpoint

- Public repository: `https://github.com/AdrianVyne/courtlink-ph`
- All branches (`main`, `feat/foundation`) are aligned and pushed.
- Implementation worktree: `C:\Users\Admin\Documents\Github\pickelball-website\.worktrees\foundation`
- Root checkout has unrelated untracked `config.yaml` and `static/` ? do not touch.

## Implementation status

All items in the implementation plan are checked complete. The marketplace is feature-complete:

- Auth: email/password, verification/reset, Google OAuth (PKCE+nonce+state)
- Courts: inventory, amenities, hours/closures, nationwide discovery, priced availability, transactional holds, overlap protection, proof upload with safe re-encoding, review/escalation, refunds
- Coaches: profiles, directed approval, open offers, atomic winner, proof review, cancellation, refunds, public profile pages with SEO
- Web: responsive workspaces, notifications, reviews, favorites, promotions, PWA, moderation, Google sign-in
- Email: SMTP transactional delivery with conditional binding
- Operations: encrypted backups, structured logs, metrics, queue visibility, alerts
- Production: Docker multi-stage, Caddy, compose.prod
- Quality: Playwright e2e scaffold with axe a11y checks, 240+ automated tests

## Known operational items (not blockers)

- CI dependency/container/security scans (lockfile policy runs at install)
- Live Google OAuth verification (needs provider credentials)
- Clean Oracle VM deployment (Docker build proven locally)

## Local commands

```powershell
Set-Location C:\Users\Admin\Documents\Github\pickelball-website\.worktrees\foundation
pnpm install
docker compose -f compose.yaml up -d
pnpm check
$env:DATABASE_URL='postgresql://courtlink:courtlink@localhost:5433/courtlink'
$env:REDIS_URL='redis://localhost:6379'
pnpm test:integration
pnpm --filter @courtlink/web test:e2e   # requires running dev server or E2E_BASE_URL
```
