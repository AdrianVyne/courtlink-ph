# Google OAuth Sign-In Design

## Goal

Add secure Google sign-in without changing CourtLink's existing session, role, tenant-authorization, or password-account model.

## Boundaries

`GoogleOAuthService` owns attempt generation, callback validation, account selection, and session issuance. `GoogleOAuthClient` abstracts Google's authorization URL, code exchange, and ID-token verification so domain tests never call the network. `PrismaGoogleOAuthRepository` owns one-time attempts and transactional account linking. `AuthController` only validates HTTP input, sets the existing session cookie, and redirects.

The flow stores no provider tokens. PostgreSQL stores only the durable provider subject link and a short-lived attempt. CourtLink remains the sole issuer and validator of application sessions.

## Start flow

`GET /api/v1/auth/google/start?returnTo=/dashboard` is public. When OAuth is disabled it returns `503 GOOGLE_OAUTH_DISABLED`. When enabled, it:

1. Normalizes `returnTo` to a safe local path.
2. Generates independent 32-byte state, nonce, and PKCE verifier values.
3. Stores the state hash, verifier, nonce, return path, and ten-minute expiry.
4. Redirects to Google's authorization endpoint with `openid email profile`, state, nonce, PKCE challenge, and `S256`.

## Callback flow

`GET /api/v1/auth/google/callback` is public. A provider cancellation consumes the matching attempt and redirects to `/login?oauthError=access_denied`. A successful callback:

1. Hashes state and atomically consumes one unexpired attempt.
2. Exchanges the code using the stored verifier and configured redirect URI.
3. Verifies the ID token through `google-auth-library` and requires matching nonce, non-empty `sub`, normalized email, `email_verified=true`, and a display name fallback derived without exposing the email address.
4. Finds or transactionally creates/links the CourtLink account.
5. Rejects non-active users with `GOOGLE_ACCOUNT_UNAVAILABLE`.
6. Issues the normal 30-day opaque CourtLink session cookie.
7. Redirects to the attempt's validated return path.

The callback never returns provider tokens or places them in URLs, cookies, logs, or database rows.

## Account linking

Provider subject is the durable identity key. If the subject is already linked, its linked user wins even if Google's email later changes. For a new subject, a verified normalized email may link an existing CourtLink user to prevent duplicate accounts. Otherwise a new active user and `PLAYER` role are created. Existing display names and roles are not overwritten. A previously unverified matching email becomes verified at first successful Google sign-in.

Concurrent callbacks use PostgreSQL transactions plus the existing unique email and `(provider, providerAccountId)` constraints. The repository returns the final linked user rather than trusting a pre-race candidate.

## Configuration

The API environment adds:

- `GOOGLE_OAUTH_ENABLED`, default `false`.
- `GOOGLE_CLIENT_ID`.
- `GOOGLE_CLIENT_SECRET`.
- `GOOGLE_REDIRECT_URI`, which must exactly match the Google console callback.

The last three values are required only when OAuth is enabled. Production Compose passes them from the deployment environment. The server-rendered web service receives `GOOGLE_OAUTH_ENABLED` only to control button visibility; API configuration remains authoritative.

## Errors and UX

Stable service codes are `GOOGLE_OAUTH_DISABLED`, `GOOGLE_OAUTH_STATE_INVALID`, `GOOGLE_OAUTH_IDENTITY_INVALID`, and `GOOGLE_ACCOUNT_UNAVAILABLE`. Start failures use coded HTTP responses. Callback failures redirect to `/login?oauthError=<stable-public-code>` so raw provider errors and personal data never reach the browser.

The login page displays a Google button only when enabled and maps callback error codes to short user-facing messages. Password login remains unchanged. Password reset upserts credentials so OAuth-created users can establish a password later.

## Verification

Unit tests prove safe return paths, PKCE/state/nonce generation, one-time callback consumption, verified-identity requirements, existing-subject reuse, verified-email linking, new-player creation, suspended-user denial, cookie secrecy, and callback error redirects. PostgreSQL integration proves attempts are consumed once and concurrent account linking produces one user/link. Environment tests prove conditional credential requirements. Web tests prove button visibility and non-sensitive error text. Live Google verification is documented but cannot be claimed without deployment credentials.
