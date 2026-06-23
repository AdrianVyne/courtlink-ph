# CourtLink PH Pause / Resume Handoff

Last updated: 2026-06-23 (Asia/Manila)

This file is the durable handoff for a future GPT/Codex session. Treat the repository, Git state, current implementation plan, and current test output as authoritative. Chat history is optional context only.

## Resume prompt

Paste this into a new GPT/Codex session opened at the repository root:

> Resume CourtLink PH from `PAUSE.md`. Read `AGENTS.md`, the approved product design, and the implementation plan. Inspect the current Git/worktree state before relying on this handoff. Work in `.worktrees/foundation` on `feat/foundation`, preserve unrelated user files, follow TDD for behavior changes, and continue the first incomplete release requirement. Update `PAUSE.md` before stopping.

## Current checkpoint

- Public repository: `https://github.com/AdrianVyne/courtlink-ph`
- Published commit: `2bedf02 feat: directed coach approval flow and coach refund/cancellation`
- `main`, `feat/foundation`, `origin/main`, and `origin/feat/foundation` were aligned at `2bedf02` when this handoff was written.
- Implementation worktree: `C:\Users\Admin\Documents\Github\pickelball-website\.worktrees\foundation`
- Implementation branch: `feat/foundation`
- The implementation worktree was clean when this handoff was written.
- The root checkout contains unrelated untracked `config.yaml` and `static/`. They belong to the user. Do not modify, delete, move, stage, or commit them unless the user explicitly requests it.

Always run `git status --short --branch`, `git worktree list`, and `git log -1 --oneline` after resuming. If current state differs, trust current state and update this file.

## Authoritative documents

Read these before changing product behavior:

1. `AGENTS.md`
2. `docs/superpowers/specs/2026-06-21-courtlink-ph-design.md`
3. `docs/superpowers/plans/2026-06-21-courtlink-ph-implementation.md`
4. Relevant ADRs in `docs/adr/`
5. Relevant verification records in `docs/verification/`

The coverage audit dated 2026-06-22 predates several completed features. It is useful historical evidence but is not a current completion audit. Refresh it during final release verification.

## Completed marketplace slices

The implementation plan currently records these major slices as complete:

- Repository governance, monorepo, strict TypeScript gates, Docker development services, CI, and public GitHub publication.
- PostgreSQL data model, versioned NestJS API, health/OpenAPI support, 24-hour idempotency-key replay protection, and migration rehearsal documentation.
- Email/password authentication, verification/reset flows, secure sessions, role/tenant authorization, venue approval, and organization staff lifecycle/audit.
- Court inventory, amenities, Manila operating hours/closures, nationwide discovery filters, priced availability, transactional holds, manual payment proof review, and court refunds.
- Coach profiles, directed approval, open offers, atomic winner selection, proof review, cancellation, and manual coach refunds.
- Responsive web workspaces, notifications, reviews, favorites, promotions, PWA support, moderation, object storage, encrypted backups, and built-in operations visibility.

Do not infer full release completion from this summary. Use unchecked plan items and fresh verification evidence.

## Remaining plan items

At the time of this handoff, the implementation plan has these unchecked items:

1. Google OAuth sign-in.
2. Per-coach public profile pages, structured metadata, and richer SEO.
3. Configured transactional SMTP delivery with retry handling.
4. Clean-machine production deployment, restart recovery, backup restoration, and migration verification.
5. Full release gate: format, lint, typecheck, unit/integration, Playwright, accessibility, security scans, and production builds.
6. End-to-end verification of every approved role, booking, payment, refund, coach-offer, moderation, privacy, and operations scenario.
7. Fresh specification-coverage audit with every gap resolved.
8. Final branch integration using the finishing-development workflow.

The approved design also requires safe image proof re-encoding. The older coverage audit marked this unproven; confirm current source/tests and keep it incomplete unless direct evidence proves it.

## Recommended next work

The first unchecked plan item is Google OAuth. It requires an approved design, environment validation, account-linking/security tests, and provider credentials for live verification. If provider credentials are unavailable, implement everything that can be verified locally, document the external verification gap accurately, and continue another independent requirement without marking OAuth complete.

For every feature slice:

1. Review the relevant design and existing architecture.
2. Record architecture changes as ADRs.
3. Write a failing test and observe the expected failure.
4. Implement the smallest complete behavior, including server-side authorization and stable API errors.
5. Update OpenAPI contracts, runbooks, implementation tracking, and verification evidence where applicable.
6. Run focused tests, then the broad gates appropriate to the change.

## Local commands

Run commands from the implementation worktree unless a command explicitly targets the root checkout.

```powershell
Set-Location C:\Users\Admin\Documents\Github\pickelball-website\.worktrees\foundation
pnpm install
docker compose -f compose.yaml up -d
pnpm check
$env:DATABASE_URL='postgresql://courtlink:courtlink@localhost:5433/courtlink'
$env:REDIS_URL='redis://localhost:6379'
pnpm test:integration
```

The required release gate also includes browser end-to-end tests, accessibility checks, security/dependency/container scans, and production deployment verification. `pnpm check` alone is not release completion.

## Publish workflow

Only publish after fresh verification and a clean implementation worktree:

```powershell
Set-Location C:\Users\Admin\Documents\Github\pickelball-website\.worktrees\foundation
git push origin feat/foundation

Set-Location C:\Users\Admin\Documents\Github\pickelball-website
git merge --ff-only feat/foundation
git push origin main
```

Before merging in the root checkout, confirm the unrelated untracked files remain untouched. Never use destructive reset/checkout commands to clean them.

## Updating this handoff

Before pausing again:

- Replace the checkpoint commit and branch state with current facts.
- Update completed and remaining requirements from the authoritative plan.
- Record the latest exact verification commands and outcomes, without secrets, tokens, personal data, payment instructions, proof URLs, or production identifiers.
- Remove obsolete blockers and add new external dependencies.
- Commit and publish this file with the corresponding project checkpoint.
