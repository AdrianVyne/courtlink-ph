export enum BookingStatus {
  Held = "held",
  ProofSubmitted = "proof_submitted",
  Confirmed = "confirmed",
  Expired = "expired",
  Rejected = "rejected",
  RefundRequested = "refund_requested",
  Refunded = "refunded",
}

const transitions: ReadonlyMap<BookingStatus, ReadonlySet<BookingStatus>> = new Map<
  BookingStatus,
  ReadonlySet<BookingStatus>
>([
  [BookingStatus.Held, new Set([BookingStatus.ProofSubmitted, BookingStatus.Expired])],
  [BookingStatus.ProofSubmitted, new Set([BookingStatus.Confirmed, BookingStatus.Rejected])],
  [BookingStatus.Confirmed, new Set([BookingStatus.RefundRequested])],
  [BookingStatus.RefundRequested, new Set([BookingStatus.Refunded])],
]);

export function canTransitionBooking(from: BookingStatus, to: BookingStatus): boolean {
  return transitions.get(from)?.has(to) ?? false;
}

export function assertBookingTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransitionBooking(from, to)) {
    throw new Error(`BOOKING_INVALID_TRANSITION:${from}->${to}`);
  }
}
