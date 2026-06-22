import { randomUUID } from "node:crypto";
import { ScheduleError, validateScheduledInterval } from "./availability-policy.js";
import {
  type CourtRepository,
  type CourtSummary,
  type Quote,
  type QuoteInput,
  QuoteError,
  quoteCourtBooking,
} from "./court.service.js";

export const HOLD_DURATION_MS = 5 * 60 * 1000;
export const REVIEW_SLA_MS = 2 * 60 * 60 * 1000;
export const REFUND_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type BookingStatus =
  | "HELD"
  | "PROOF_SUBMITTED"
  | "CONFIRMED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED"
  | "COMPLETED"
  | "REFUND_REQUESTED";

export interface BookingRecord {
  id: string;
  courtId: string;
  playerId: string;
  status: BookingStatus;
  startsAt: Date;
  endsAt: Date;
  quotedAmount: number;
  currency: "PHP";
  proofDeadline: Date;
  reviewDueAt: Date | null;
  createdAt: Date;
}

export interface PaymentChannel {
  value: "GCASH" | "MAYA" | "QR_PH" | "BANK_TRANSFER" | "OTHER";
}

export interface PaymentSubmissionRecord {
  id: string;
  bookingId: string;
  channel: PaymentChannel["value"];
  transactionRef: string;
  proofObjectKey: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

export interface BookingRepository {
  createHold(input: {
    courtId: string;
    playerId: string;
    startsAt: Date;
    endsAt: Date;
    quotedAmount: number;
    proofDeadline: Date;
  }): Promise<BookingRecord>;
  getBooking(id: string): Promise<BookingRecord | null>;
  getSubmission(
    id: string,
  ): Promise<{ id: string; bookingId: string; proofObjectKey: string } | null>;
  transitionStatus(
    id: string,
    expected: BookingStatus,
    next: BookingStatus,
    extras?: { reviewDueAt?: Date | null },
  ): Promise<BookingRecord>;
  submitPayment(input: {
    bookingId: string;
    channel: PaymentChannel["value"];
    transactionRef: string;
    proofObjectKey: string;
  }): Promise<PaymentSubmissionRecord>;
  decidePayment(input: {
    submissionId: string;
    decision: "APPROVED" | "REJECTED";
    reviewedById: string;
    reason: string | null;
  }): Promise<PaymentSubmissionRecord>;
  expireStaleHolds(now: Date): Promise<number>;
}

export class BookingError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "BookingError";
  }
}

export class BookingService {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly courts: CourtRepository,
  ) {}

  getBookingById(id: string): Promise<BookingRecord | null> {
    return this.bookings.getBooking(id);
  }

  getSubmissionById(
    id: string,
  ): Promise<{ id: string; bookingId: string; proofObjectKey: string } | null> {
    return this.bookings.getSubmission(id);
  }

  async quote(courtId: string, input: QuoteInput): Promise<Quote & { court: CourtSummary }> {
    const court = await this.courts.findCourtById(courtId);
    if (!court?.active) throw new BookingError("COURT_NOT_AVAILABLE", "Court not bookable");
    const rules = await this.courts.listPricingRules(courtId);
    try {
      const schedule = await this.courts.getSchedule(courtId);
      validateScheduledInterval(
        court,
        schedule.operatingHours,
        schedule.closures,
        input.startsAt,
        input.endsAt,
      );
      const quote = quoteCourtBooking(court, rules, input);
      return { ...quote, court };
    } catch (error) {
      if (error instanceof ScheduleError) throw new BookingError(error.code, error.message);
      if (error instanceof QuoteError) throw new BookingError(error.code, error.message);
      throw error;
    }
  }

  async createHold(input: {
    courtId: string;
    playerId: string;
    startsAt: Date;
    endsAt: Date;
    now?: Date;
  }): Promise<BookingRecord> {
    const now = input.now ?? new Date();
    const quoted = await this.quote(input.courtId, {
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });
    const proofDeadline = new Date(now.getTime() + HOLD_DURATION_MS);
    return this.bookings.createHold({
      courtId: input.courtId,
      playerId: input.playerId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      quotedAmount: quoted.totalAmount,
      proofDeadline,
    });
  }

  async submitProof(input: {
    bookingId: string;
    playerId: string;
    channel: PaymentChannel["value"];
    transactionRef: string;
    proofObjectKey: string;
    now?: Date;
  }): Promise<{ booking: BookingRecord; submission: PaymentSubmissionRecord }> {
    const booking = await this.bookings.getBooking(input.bookingId);
    if (!booking) throw new BookingError("BOOKING_NOT_FOUND", "Booking not found");
    if (booking.playerId !== input.playerId)
      throw new BookingError("BOOKING_FORBIDDEN", "Not your booking");
    const now = input.now ?? new Date();
    if (booking.status !== "HELD")
      throw new BookingError("BOOKING_STATUS_INVALID", `Cannot submit proof for ${booking.status}`);
    if (now > booking.proofDeadline)
      throw new BookingError("HOLD_EXPIRED", "Hold expired before proof submission");

    const submission = await this.bookings.submitPayment({
      bookingId: booking.id,
      channel: input.channel,
      transactionRef: input.transactionRef,
      proofObjectKey: input.proofObjectKey,
    });
    const reviewDueAt = new Date(now.getTime() + REVIEW_SLA_MS);
    const next = await this.bookings.transitionStatus(booking.id, "HELD", "PROOF_SUBMITTED", {
      reviewDueAt,
    });
    return { booking: next, submission };
  }

  async approveProof(input: {
    submissionId: string;
    bookingId: string;
    reviewedById: string;
    reason?: string | null;
  }): Promise<BookingRecord> {
    await this.bookings.decidePayment({
      submissionId: input.submissionId,
      decision: "APPROVED",
      reviewedById: input.reviewedById,
      reason: input.reason ?? null,
    });
    return this.bookings.transitionStatus(input.bookingId, "PROOF_SUBMITTED", "CONFIRMED");
  }

  async rejectProof(input: {
    submissionId: string;
    bookingId: string;
    reviewedById: string;
    reason: string;
  }): Promise<BookingRecord> {
    await this.bookings.decidePayment({
      submissionId: input.submissionId,
      decision: "REJECTED",
      reviewedById: input.reviewedById,
      reason: input.reason,
    });
    return this.bookings.transitionStatus(input.bookingId, "PROOF_SUBMITTED", "REJECTED");
  }
}

export function newBookingId(): string {
  return randomUUID();
}
