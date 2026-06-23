# CourtLink PH Agent Guide

## Product

CourtLink PH is a nationwide, pickleball-only marketplace for court and coach bookings in the Philippines. Read `docs/superpowers/specs/2026-06-21-courtlink-ph-design.md` before changing product behavior and record architecture changes as ADRs.

For session continuation, read `PAUSE.md` before relying on chat history. Verify its checkpoint against current Git state and update it before pausing again.

## Engineering rules

- Use TypeScript in strict mode and keep domain logic independent of web frameworks.
- Follow test-driven development for behavior changes: failing test, minimal implementation, refactor.
- Treat `Asia/Manila` as the product timezone while storing timestamps in UTC.
- Enforce tenant authorization in API service methods; UI visibility is not authorization.
- Use database transactions and constraints for booking and offer concurrency.
- Never log secrets, payment instructions, proof URLs, authentication tokens, or personal data.
- Never commit `.env` files, production identifiers, uploaded proofs, or database backups.
- Update OpenAPI contracts, tests, ADRs, and runbooks when interfaces or operations change.

## Commands

Commands will be finalized by the repository bootstrap task. The required quality gate is format, lint, typecheck, unit/integration tests, end-to-end tests, and production build.

