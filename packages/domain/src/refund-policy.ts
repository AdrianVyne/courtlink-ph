const sevenDaysMilliseconds = 7 * 24 * 60 * 60 * 1000;

export enum CancellationCause {
  Player = "player",
  Venue = "venue",
}

export interface RefundEligibilityInput {
  bookingStartsAt: Date;
  requestedAt: Date;
  cause: CancellationCause;
}

export function isRefundEligible(input: RefundEligibilityInput): boolean {
  if (input.cause === CancellationCause.Venue) {
    return true;
  }

  return input.bookingStartsAt.getTime() - input.requestedAt.getTime() >= sevenDaysMilliseconds;
}
