# Coach Directed Approval and Refund Lifecycle - 2026-06-23

## Scope

Explicit coach approval for directed coaching requests before payment, plus
player/coach cancellation rules and manual coach refund records. Also repairs a
regression where the web client did not send the now-mandatory `Idempotency-Key`
header on booking and payment mutations.

## Behaviour

- A request that targets a coach is created as `PENDING_COACH`. No offer can be made
  until the targeted coach approves it (the offer guard reports `REQUEST_NOT_OPEN`).
- The targeted coach approves (request becomes `OPEN`) or declines (request becomes
  `DECLINED`). A declined request cannot be approved later (`REQUEST_NOT_PENDING`).
  Approval/decline by a non-targeted coach is rejected.
- Player refunds on a confirmed coaching booking require at least seven days notice and
  coach approval, then a manual completion that records channel and reference. Coach-caused
  cancellation is always refund-eligible. These mirror the court refund policy and reuse the
  shared domain refund rule.
- Notifications fire for directed-request creation, approval, decline, refund request,
  refund decision, and coach cancellation.

## Automated gates

- `pnpm check`: 18 of 18 tasks successful (API 179 unit tests including 13 coach-market and
  7 coach-refund tests; web typecheck and build; lint and format).
- `pnpm test:integration`: 8 of 8 task groups successful; API 44 integration scenarios
  including 5 new coach approval/refund scenarios against PostgreSQL.

## Live HTTP checks against the running API and PostgreSQL

- Directed request returned `PENDING_COACH`.
- Offer before approval returned 400; player (no coach profile) approve returned 400.
- Targeted coach approve returned 200 and `OPEN`; offer then succeeded; player accept
  returned 201 `HELD`.
- Refund request and coach cancel on a `HELD` (unpaid) booking returned 400.
- Decline returned 200 and `DECLINED`; a later approve returned 409 with body
  `{"code":"REQUEST_NOT_PENDING"}`.
- Court hold with an `Idempotency-Key` returned 201 `HELD`; the same hold without the header
  returned 400 `IDEMPOTENCY_KEY_REQUIRED`, confirming the mandatory-key contract that the web
  client now satisfies automatically for all mutations.

## Web

The coach workspace now lists directed requests awaiting approval with Approve/Decline
actions and a Cancel-session action on confirmed bookings. The player coaching view adds a
Request-refund action on confirmed bookings. `apiFetch` attaches an `Idempotency-Key` to
every non-GET request, and the multipart proof-upload calls send one explicitly.
