import { generateCandidateIntervals, intervalsOverlap } from "./availability-policy.js";
import { BookingError } from "./booking.service.js";
import { type CourtRepository, QuoteError, quoteCourtBooking } from "./court.service.js";

export interface PricedSlot {
  startsAt: Date;
  endsAt: Date;
  totalAmount: number;
  currency: "PHP";
}

export class AvailabilityService {
  constructor(private readonly courts: CourtRepository) {}

  async listPricedSlots(
    courtId: string,
    manilaDate: string,
    durationMin: number,
  ): Promise<PricedSlot[]> {
    const court = await this.courts.findCourtById(courtId);
    if (!court?.active) throw new BookingError("COURT_NOT_AVAILABLE", "Court not bookable");
    const [schedule, rules] = await Promise.all([
      this.courts.getSchedule(courtId),
      this.courts.listPricingRules(courtId),
    ]);
    const candidates = generateCandidateIntervals(
      court,
      schedule.operatingHours,
      manilaDate,
      durationMin,
    );
    if (candidates.length === 0) return [];
    const first = candidates[0];
    const last = candidates.at(-1);
    if (!first || !last) return [];
    const bookings = await this.courts.listBlockingBookings(courtId, first.startsAt, last.endsAt);

    const slots: PricedSlot[] = [];
    for (const candidate of candidates) {
      const blockedByClosure = schedule.closures.some((closure) =>
        intervalsOverlap(candidate.startsAt, candidate.endsAt, closure.startsAt, closure.endsAt),
      );
      const blockedByBooking = bookings.some((booking) =>
        intervalsOverlap(candidate.startsAt, candidate.endsAt, booking.startsAt, booking.endsAt),
      );
      if (blockedByClosure || blockedByBooking) continue;
      try {
        const quote = quoteCourtBooking(court, rules, candidate);
        slots.push({
          startsAt: candidate.startsAt,
          endsAt: candidate.endsAt,
          totalAmount: quote.totalAmount,
          currency: quote.currency,
        });
      } catch (error) {
        if (error instanceof QuoteError && error.code === "QUOTE_NO_PRICING_RULE") continue;
        throw error;
      }
    }
    return slots;
  }
}
