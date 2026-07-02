# Contributing to CourtLink PH

CourtLink PH accepts focused issues and pull requests that match the approved product specification.

## Development

1. Install Node.js 24, pnpm 11.8, Docker, and Git.
2. Copy `.env.example` to `.env` and replace local placeholder secrets.
3. Run `docker compose up -d --wait postgres redis`.
4. Run `pnpm install` and `pnpm --filter @courtlink/database db:migrate`.
5. Run `pnpm check` and `pnpm test:integration` before opening a pull request.

Use failing tests to define behavior before implementation. Never include real user data, payment proofs, credentials, or production infrastructure identifiers in an issue, fixture, screenshot, commit, or log.

## Pull requests

All changes to `main` go through pull requests unless the repository owner explicitly bypasses protection for emergency maintenance. Pull requests should be narrow, include the relevant verification output, and keep product behavior aligned with the approved specs in `docs/superpowers/specs/`.

Do not open public pull requests or issues for suspected vulnerabilities. Use the repository's private vulnerability reporting flow instead.

By contributing, you agree that your contribution is licensed under AGPL-3.0-only.

