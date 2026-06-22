ALTER TABLE "court_bookings"
  DROP CONSTRAINT "court_bookings_no_active_overlap";

ALTER TABLE "court_bookings"
  ADD CONSTRAINT "court_bookings_no_active_overlap"
  EXCLUDE USING gist (
    "courtId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  )
  WHERE ("status" IN ('HELD', 'PROOF_SUBMITTED', 'CONFIRMED', 'REFUND_REQUESTED'));
