# ADR 0005: Google OAuth authorization-code sign-in

## Status

Accepted

## Context

CourtLink PH requires Google sign-in alongside verified email/password accounts. The API owns sessions and tenant authorization, so delegating application sessions to a web-framework authentication layer would split identity policy across services. OAuth must resist login CSRF, authorization-code interception, callback replay, open redirects, and duplicate-account races without persisting Google access or refresh tokens.

## Decision

Implement Google OpenID Connect through the NestJS API using the authorization-code flow, PKCE (`S256`), a cryptographic state value, and an OIDC nonce. Use Google's maintained `google-auth-library` to build the authorization URL, exchange the code, and verify ID-token signature, issuer, audience, expiration, and nonce.

Persist a ten-minute `GoogleOAuthAttempt` containing only a SHA-256 state hash, the short-lived PKCE verifier and nonce, a validated relative return path, and expiry timestamps. Callback consumption atomically deletes the attempt so only one callback can use it. Opportunistic cleanup removes expired attempts.

After Google returns a verified `sub`, verified email, and display name:

- Reuse an existing `(provider, providerAccountId)` link when present.
- Otherwise link to the existing normalized email account or create a new active player account with `emailVerifiedAt` set.
- Perform user creation/linking in one PostgreSQL transaction and rely on unique constraints for races.
- Reject suspended/deleted users.
- Issue the existing opaque CourtLink session cookie and never persist Google access, refresh, or ID tokens.

Only relative paths beginning with one slash are accepted as `returnTo`; protocol-relative and absolute URLs fall back to `/dashboard`. Provider cancellation and known OAuth failures redirect to `/login` with a non-sensitive stable error code.

OAuth is disabled by default. Enabling it requires `GOOGLE_OAUTH_ENABLED=true`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and an exact `GOOGLE_REDIRECT_URI`. The server-rendered web service receives the same enabled flag only for button visibility.

OAuth-only users may later request a password reset. Password persistence therefore upserts a credential instead of assuming one already exists.

## Consequences

The API gains a short-lived attempt table, a Google client adapter, public start/callback routes, and conditional environment validation. Google credentials remain deployment secrets. Automated tests use a fake provider client; live provider verification remains an external deployment check requiring approved Google credentials and redirect URIs.

## References

- `https://developers.google.com/identity/protocols/oauth2/web-server`
- `https://developers.google.com/identity/sign-in/web/backend-auth`
