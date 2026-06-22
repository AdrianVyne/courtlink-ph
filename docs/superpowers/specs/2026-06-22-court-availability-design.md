# CourtLink PH Court Availability Design

## Purpose

Court availability must be authoritative rather than decorative. A court booking is valid only when the court is active, the requested interval is aligned to its slot increment, the full interval is inside one configured operating window in `Asia/Manila`, no closure overlaps it, and no blocking booking overlaps it.

## Schedule model

Each court may have multiple operating windows per weekday. Weekdays use JavaScript/PostgreSQL convention `0 = Sunday` through `6 = Saturday`. A window is local Manila wall-clock minutes with `opensMinute < closesMinute`; overnight windows are not supported in the initial release and must be represented as two windows on adjacent days.

A court with no operating windows is unavailable. This closed-by-default rule prevents newly created courts from accidentally accepting bookings before setup. The demo seed creates explicit daily windows so local development remains usable.

Closures are UTC timestamp ranges with an optional operator reason. A closure overlaps a request when `requestStart < closureEnd` and `requestEnd > closureStart`. Creating a closure that overlaps a blocking booking is rejected; staff must cancel/refund affected bookings first. Blocking statuses are `HELD`, `PROOF_SUBMITTED`, `CONFIRMED`, and `REFUND_REQUESTED`.

## Availability rules

The requested start and end must fall on the same Manila calendar day and inside a single operating window. Duration must remain within court minimum/maximum limits and be divisible by the slot increment. Start time must also align relative to the selected window's opening minute.

Public slot listing accepts a court ID, a Manila date (`YYYY-MM-DD`), and a duration in minutes. It generates candidates from each operating window at the court increment, excludes closures and blocking bookings, quotes each remaining candidate with the existing pricing rules, and returns UTC ISO timestamps plus PHP price. Candidates without an applicable price rule are omitted. Requests are limited to one date and the existing maximum duration, keeping response cost bounded.

Quotes validate schedule and closure rules but do not promise that another player has not just taken the slot. Holds repeat schedule checks and create the booking inside one PostgreSQL transaction; the existing exclusion constraint remains the final concurrent-booking guard. A closure insertion checks active bookings in its transaction.

## Interfaces

Public endpoints:

- `GET /api/v1/courts/:id/availability?date=YYYY-MM-DD&durationMin=60`
- existing `GET /api/v1/courts/:id/quote` now rejects closed or closure-overlapping intervals.

Owner/manager endpoints:

- `GET /api/v1/courts/:id/schedule`
- `PUT /api/v1/courts/:id/operating-hours` replaces all weekly windows atomically.
- `POST /api/v1/courts/:id/closures` creates a closure after conflict checks.
- `DELETE /api/v1/courts/:id/closures/:closureId` removes one closure belonging to that court.

All management endpoints resolve the court to its venue/business and enforce tenant roles in the API service path. UI visibility is not authorization.

## Web experience

The venue workspace shows a compact weekly schedule editor and upcoming closure list per court. Players choose a date and duration on a court card, load server-generated available slots, then select a slot before creating a hold. The UI displays all times in `Asia/Manila` and does not calculate availability independently.

## Errors

Stable domain codes distinguish `COURT_CLOSED`, `COURT_CLOSURE_CONFLICT`, `COURT_SLOT_MISALIGNED`, `COURT_CROSS_DAY`, `COURT_BOOKING_CONFLICT`, and `CLOSURE_BOOKINGS_EXIST`. Public errors do not reveal other player or booking information.

## Testing

Pure tests cover Manila day/minute conversion, window containment, opening-relative alignment, cross-midnight rejection, closure overlap, and candidate generation. Service tests prove quotes and holds reject invalid schedules. PostgreSQL integration tests prove a closure cannot cover an active booking, a hold cannot enter a closure, and concurrent holds retain the existing overlap constraint. API tests prove cross-tenant schedule denial. Web tests prove players render only server-returned slots and managers submit Manila-local schedule values.
