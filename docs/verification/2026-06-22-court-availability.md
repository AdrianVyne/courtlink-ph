# Court Availability Verification - 2026-06-22

## Scope

This record covers Manila-local court operating hours, closures, transactional booking enforcement, tenant authorization, public priced slots, and the venue schedule workspace. Timestamps remain stored and exchanged in UTC while venue inputs and display use `Asia/Manila`.

## Automated evidence

- `pnpm check` completed with 18/18 Turborepo tasks. Biome checked 230 formatted files and 231 linted files. The gate included all typechecks and production builds.
- API unit tests: 31 files, 124 tests passed.
- Web component tests: 6 files, 11 tests passed, including five schedule-manager/time-boundary tests and the server-slot booking test.
- Worker unit tests: 4 files, 8 tests passed. Domain tests: 4 files, 11 tests passed. Backup tests: 2 files, 7 tests passed.
- `pnpm test:integration` completed with 8/8 task groups.
- API integration tests: 13 files, 25 tests passed. These include closure enforcement, `REFUND_REQUESTED` blocking, concurrent hold protection, and cross-tenant schedule denial.
- Database overlap integration: 1 file, 1 test passed. Worker integration: 2 files, 3 tests passed.

## Live HTTP evidence

The database was reseeded, the production-built API was started on the local development services, and the following behavior was exercised without recording cookies, tokens, account data, or resource identifiers:

| Check | Result |
| --- | --- |
| Venue-owner login | HTTP 200 |
| Replace seven-day operating hours | HTTP 200 |
| Create a UTC-backed Manila closure | HTTP 201 |
| Fetch 60-minute public availability | 24 priced slots |
| Returned slots overlapping the closure | 0 |
| Quote outside operating hours | HTTP 409, `COURT_CLOSED` |
| Player login | HTTP 200 |
| Create hold for a returned valid interval | HTTP 201, `HELD` |

The temporary API process was stopped after verification.

## Invariants proven

- Courts are closed unless an operating window authorizes the requested Manila-local interval.
- Closure and blocking-booking conflicts are enforced again inside database transactions.
- Concurrent overlapping holds yield a stable conflict instead of double booking.
- Only owners and managers of the court's tenant can read or mutate schedules.
- Public booking controls use server-returned UTC slots and prices; they do not synthesize availability in the browser.
- The management workspace preserves multiple weekday windows and performs explicit `+08:00` conversion for closure inputs.
