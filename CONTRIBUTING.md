# Contributing to CourtLink PH

CourtLink PH accepts focused issues and pull requests that match the approved product specification.

## Development

1. Install Node.js 24, pnpm 11.8, Docker, and Git.
2. Copy `.env.example` to `.env` and replace local placeholder secrets.
3. Run `docker compose up -d --wait postgres redis`.
4. Run `pnpm install` and `pnpm --filter @courtlink/database db:migrate`.
5. Run `pnpm check` and `pnpm test:integration` before opening a pull request.

Use failing tests to define behavior before implementation. Never include real user data, payment proofs, credentials, or production infrastructure identifiers in an issue, fixture, screenshot, commit, or log.

By contributing, you agree that your contribution is licensed under AGPL-3.0-only.

