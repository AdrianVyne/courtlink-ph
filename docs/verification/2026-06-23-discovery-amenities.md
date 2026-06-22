# Venue Amenities and Nationwide Discovery Filters - 2026-06-23

## Scope

A venue/court amenity catalog with owner assignment and public display, plus nationwide
discovery filtering by location, price, amenities, and date/time availability.

## Automated gates

- `pnpm check`: 18 of 18 tasks successful (API 167 unit tests including amenity-service and
  discovery-service suites; web typecheck and production build; all lint and format).
- `pnpm test:integration`: 8 of 8 task groups successful; API 39 integration scenarios
  including the discovery flow (city, amenity, price, and availability with a booked-court
  exclusion against PostgreSQL). Suite runs with turbo `--concurrency=1`.

## Live HTTP checks against the running API and PostgreSQL

- `GET /amenities` returned the 14-entry catalog.
- Owner `PUT /venues/:id/amenities` with `[PARKING, SHOWERS]` returned 200 and the keys
  appeared on `GET /venues/by-slug/...`.
- A court-only amenity (`INDOOR`) on a venue returned 400 `AMENITY_SCOPE_INVALID`; a
  venue-only amenity (`PARKING`) on a court returned 400.
- Owner `PUT /courts/:id/amenities` with `[INDOOR, COURT_LIGHTS]` returned 200 and the keys
  appeared on `GET /courts/:id`.
- Discovery `GET /venues`:
  - `amenities=PARKING,SHOWERS` matched the venue; `amenities=CAFE` returned none.
  - Repeated `amenities=PARKING&amenities=SHOWERS` (checkbox form style) also matched.
  - `maxPrice=200` returned none (court priced at 250); `maxPrice=300` matched with
    `fromPrice=250`.
  - `availableDate=2026-06-22&durationMin=60` matched with `availableCourtCount=1` and
    `fromPrice=250`.

## Design notes

The discovery availability and price evaluation reuse the existing scheduling helpers
(`generateCandidateIntervals`, `intervalsOverlap`, `quoteCourtBooking`) so booking rules,
closures, active-booking conflicts, and Asia/Manila boundaries stay consistent with the
booking path. The amenity catalog is seeded by migration and idempotently assigned to the
demo venue/court by the seed script. Amenity scope (VENUE, COURT, BOTH) is enforced on
assignment.
