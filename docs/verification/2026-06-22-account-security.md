# Email Verification and Password Reset Verification - 2026-06-22

## Scope

Email verification and password reset for email/password accounts. Google OAuth remains
unimplemented and is tracked separately in the implementation plan.

## Automated gates

- `pnpm check`: 18 of 18 tasks successful (API 141 unit tests including 8 new
  account-security service tests; all typechecks, lint, and builds passed).
- `turbo run test:integration --concurrency=1`: 8 of 8 task groups successful; API 33
  integration scenarios including 3 new account-security scenarios. The suite is run
  serially because `review-escalation` scans global overdue reviews and races with the
  API booking/refund groups when integration packages run in parallel; this race predates
  this change and does not occur serially.

## Live HTTP checks against the running API and PostgreSQL

- `POST /auth/register` returned 201 and created a real `EMAIL_VERIFICATION` token row for
  the new account.
- `POST /auth/email/verify` with an invalid token returned 400 `VERIFICATION_TOKEN_INVALID`.
- `POST /auth/password/reset/request` for the registered email returned 202 and created a
  `PASSWORD_RESET` token row.
- `POST /auth/password/reset/request` for an unknown email returned 202 and created zero
  token rows, so the endpoint does not reveal whether an account exists.
- `POST /auth/password/reset` with an invalid token returned 400 `RESET_TOKEN_INVALID`.
- `POST /auth/email/verification/request` for the registered email returned 202.

Raw verification and reset tokens are delivered only by email and stored as SHA-256
hashes, so they are never returned over HTTP. The successful token-consumption paths
(verify marks the user verified and rejects reuse; reset updates the password hash,
revokes sessions, and consumes the token) are proven against real PostgreSQL by the
integration tests.

## Notes

The development email adapter logs delivery metadata only and never logs the verification
or reset link, so tokens are not exposed in logs.
