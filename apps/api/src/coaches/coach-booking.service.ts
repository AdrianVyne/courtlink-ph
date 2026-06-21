import type { CoachBookingRecord, CoachBookingStatus } from "./coach-market.service.js";

export const COACH_REVIEW_SLA_MS = 2 * 60 * 60 * 1000;

export interface CoachPaymentRecord {
  id: string;
  bookingId: string;
  channel: "GCASH" | "MAYA" | "QR_PH" | "BANK_TRANSFER" | "OTHER";
  transactionRef: string;
  proofObjectKey: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

export interface CoachBookingRepository {
  getBooking(id: string): Promise<CoachBookingRecord | null>;
  transitionStatus(
    id: string,
    expected: CoachBookingStatus,
    next: CoachBookingStatus,
    extras?: { reviewDueAt?: Date | null },
  ): Promise<CoachBookingRecord>;
  submitPayment(input: {
    bookingId: string;
    channel: CoachPaymentRecord["channel"];
    transactionRef: string;
    proofObjectKey: string;
  }): Promise<CoachPaymentRecord>;
  decidePayment(input: {
    submissionId: string;
    decision: "APPROVED" | "REJECTED";
    reason: string | null;
  }): Promise<CoachPaymentRecord>;
}

export class CoachBookingError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "CoachBookingError";
  }
}

export class CoachBookingService {
  constructor(private readonly bookings: CoachBookingRepository) {}

  getBookingById(id: string): Promise<CoachBookingRecord | null> {
    return this.bookings.getBooking(id);
  }

  async submitProof(input: {
    bookingId: string;
    playerId: string;
    channel: CoachPaymentRecord["channel"];
    transactionRef: string;
    proofObjectKey: string;
    now?: Date;
  }): Promise<{ booking: CoachBookingRecord; submission: CoachPaymentRecord }> {
    const booking = await this.bookings.getBooking(input.bookingId);
    if (!booking) throw new CoachBookingError("COACH_BOOKING_NOT_FOUND", "Booking not found");
    if (booking.playerId !== input.playerId) {
      throw new CoachBookingError("COACH_BOOKING_FORBIDDEN", "Not your booking");
    }
    if (booking.status !== "HELD") {
      throw new CoachBookingError(
        "COACH_BOOKING_STATUS_INVALID",
        `Cannot submit proof for ${booking.status}`,
      );
    }
    const now = input.now ?? new Date();
    if (booking.proofDeadline && now > booking.proofDeadline) {
      throw new CoachBookingError("COACH_HOLD_EXPIRED", "Hold expired before proof submission");
    }

    const submission = await this.bookings.submitPayment({
      bookingId: booking.id,
      channel: input.channel,
      transactionRef: input.transactionRef,
      proofObjectKey: input.proofObjectKey,
    });
    const reviewDueAt = new Date(now.getTime() + COACH_REVIEW_SLA_MS);
    const next = await this.bookings.transitionStatus(booking.id, "HELD", "PROOF_SUBMITTED", {
      reviewDueAt,
    });
    return { booking: next, submission };
  }

  async approveProof(input: {
    submissionId: string;
    bookingId: string;
    reason?: string | null;
  }): Promise<CoachBookingRecord> {
    await this.bookings.decidePayment({
      submissionId: input.submissionId,
      decision: "APPROVED",
      reason: input.reason ?? null,
    });
    return this.bookings.transitionStatus(input.bookingId, "PROOF_SUBMITTED", "CONFIRMED");
  }

  async rejectProof(input: {
    submissionId: string;
    bookingId: string;
    reason: string;
  }): Promise<CoachBookingRecord> {
    await this.bookings.decidePayment({
      submissionId: input.submissionId,
      decision: "REJECTED",
      reason: input.reason,
    });
    return this.bookings.transitionStatus(input.bookingId, "PROOF_SUBMITTED", "REJECTED");
  }
}
