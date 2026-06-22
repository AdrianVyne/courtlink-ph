# ADR 0004: Idempotency keys for booking and payment mutations

## Status

Accepted

## Context

Manual-payment booking flows are retried by clients on flaky mobile networks. Without
deduplication, a retried POST can create duplicate holds, duplicate payment
submissions, duplicate refund records, or duplicate coach offers. The owner approved
mandatory idempotency for every court and coach booking/payment state transition, a
24-hour retention window, and a PostgreSQL-backed implementation that participates in
the same transaction as the mutation it protects.

## Decision

Require an `Idempotency-Key` header on every protected booking/payment mutation.
Persist an `IdempotencyRecord` row keyed by `(actorId, method, path, key)` with a
canonical hash of the request body, the captured HTTP status, and a JSON snapshot of
the response. The record is created and the mutation runs inside one PostgreSQL
transaction so either both commit or neither does.

Replay semantics:

- First request with a key executes the mutation, stores the response snapshot, and
  returns it.
- A repeated request with the same key and the same request hash replays the stored
  status and response without re-running business logic.
- A repeated request with the same key but a different request hash returns
  `409 IDEMPOTENCY_KEY_REUSED`.
- Records older than 24 hours are eligible for cleanup and a fresh key may be reused.

The key is scoped to the authenticated actor so one user cannot probe or collide with
another user's keys. Multipart proof uploads hash the declared fields plus the proof
content digest; proof bytes are never stored in or logged by the record.

## Consequences

Clients must send a stable `Idempotency-Key` per logical action; missing keys are
rejected with `400 IDEMPOTENCY_KEY_REQUIRED`. The API gains one interceptor and one
table, and protected handlers run inside a request-scoped transaction. A worker job
prunes expired records to bound table growth. The public API contract changes, so the
OpenAPI document and runbooks are updated alongside this ADR.
