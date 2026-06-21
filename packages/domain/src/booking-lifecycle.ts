export enum BookingStatus {
  Held = "held",
  ProofSubmitted = "proof_submitted",
  Confirmed = "confirmed",
  Expired = "expired",
}

const transitions: ReadonlyMap<BookingStatus, ReadonlySet<BookingStatus>> = new Map([
  [BookingStatus.Held, new Set([BookingStatus.ProofSubmitted, BookingStatus.Expired])],
]);

export function canTransitionBooking(from: BookingStatus, to: BookingStatus): boolean {
  return transitions.get(from)?.has(to) ?? false;
}

export function assertBookingTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransitionBooking(from, to)) {
    throw new Error(`BOOKING_INVALID_TRANSITION:${from}->${to}`);
  }
}
