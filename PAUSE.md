# CourtLink PH Pause / Resume Handoff

Last updated: 2026-06-23 (Asia/Manila)

This file is the durable handoff for a future GPT/Codex session. Treat the repository, Git state, current implementation plan, and current test output as authoritative. Chat history is optional context only.

## Resume prompt

Paste this into a new GPT/Codex session opened at the repository root:

> Resume CourtLink PH from `PAUSE.md`. Read `AGENTS.md`, the approved product design, and the implementation plan. Inspect the current Git/worktree state before relying on this handoff. Work in `.worktrees/foundation` on `feat/foundation`, preserve unrelated user files, follow TDD for behavior changes, and continue the first incomplete release requirement. Update `PAUSE.md` before stopping.

## Current checkpoint

- Public repository: `https://github.com/AdrianVyne/courtlink-ph`
- Published commit: see `git log -1 --oneline` (Google OAuth, coach profiles, SMTP delivery committed)
- `main`, `feat/foundation`, `origin/main`, and `origin/feat/foundation` are aligned.
- Implementation worktree: `C:\Users\Admin\Documents\Github\pickelball-website\.worktrees\foundation`
- Implementation branch: `feat/foundation`
- The root checkout contains unrelated untracked `config.yaml` and `static/`. They belong to the user. Do not modify, delete, move, stage, or commit them.

## Authoritative documents

1. `AGENTS.md`
2. `docs/superpowers/specs/2026-06-21-courtlink-ph-design.md`
3. `docs/superpowers/plans/2026-06-21-courtlink-ph-implementation.md`
4. `docs/verification/2026-06-23-release-coverage-audit.md`
5. Relevant ADRs in `docs/adr/`

## Completed marketplace features

All approved product features are implemented and covered by automated tests:

- Repository governance, monorepo, strict TypeScript, Docker dev services, CI, public GitHub
- PostgreSQL data model, versioned NestJS API, OpenAPI, idempotency keys, migration runbooks
- Email/password auth, email verification/reset, Google OAuth (PKCE+nonce), roles, tenancy, venue approval, staff invitations
- Courts: inventory, amenities, Manila hours/closures, nationwide discovery, priced availability, transactional holds, overlap protection, manual payment proof, escalation, refunds
- Coaches: profiles, directed approval, open offers, atomic winner selection, proof review, cancellation, refunds, per-coach public profiles with SEO
- Web: responsive workspaces, notifications, reviews, favorites, promotions, PWA, moderation
- SMTP transactional email with conditional binding (Brevo-compatible)
- Operations: encrypted backups, structured logs, metrics, queue visibility, alerts
- Production: Docker multi-stage, Caddy reverse proxy, compose.prod validated

## Remaining plan items

1. Complete branch integration using the finishing-a-development-branch workflow.

## Known gaps (operational, not feature)

- Playwright browser e2e test infrastructure
- Automated WCAG 2.2 AA accessibility checks
- CI dependency/container/security scans
- Live Google OAuth verification (needs provider credentials)
- Clean Oracle VM deployment (Docker build proven locally)
- Safe proof image re-encoding (MIME/size checks exist)

## Local commands

```powershell
Set-Location C:\Users\Admin\Documents\Github\pickelball-website\.worktrees\foundation
pnpm install
docker compose -f compose.yaml up -d
pnpm check
$env:DATABASE_URL='postgresql://courtlink:courtlink@localhost:5433/courtlink'
$env:REDIS_URL='redis://localhost:6379'
pnpm test:integration
```

## Publish workflow

```powershell
Set-Location C:\Users\Admin\Documents\Github\pickelball-website\.worktrees\foundation
git push origin feat/foundation

Set-Location C:\Users\Admin\Documents\Github\pickelball-website
git merge --ff-only feat/foundation
git push origin main
```
