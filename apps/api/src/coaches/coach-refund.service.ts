import { CancellationCause, isRefundEligible } from "@courtlink/domain";

export type RefundStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "COMPLETED";
export type RefundChannel = "GCASH" | "MAYA" | "QR_PH" | "BANK_TRANSFER" | "OTHER";

export interface CoachRefundRecord {
  id: string;
  bookingId: string;
  status: RefundStatus;
  amount: number;
  reason: string;
  channel: RefundChannel | null;
  transactionRef: string | null;
}

export interface CoachRefundBookingView {
  id: string;
  playerId: string;
  coachId: string;
  status: string;
  startsAt: Date;
  amount: number;
}

export interface CoachRefundRepository {
  getBooking(id: string): Promise<CoachRefundBookingView | null>;
  getRefund(id: string): Promise<CoachRefundRecord | null>;
  createRefundRequest(input: {
    bookingId: string;
    amount: number;
    reason: string;
  }): Promise<CoachRefundRecord>;
  decideRefund(input: {
    refundId: string;
    decision: "APPROVED" | "REJECTED";
    now: Date;
  }): Promise<CoachRefundRecord>;
  completeRefund(input: {
    refundId: string;
    channel: RefundChannel;
    transactionRef: string;
    now: Date;
  }): Promise<CoachRefundRecord>;
  coachCancel(input: {
    bookingId: string;
    reason: string;
    amount: number;
  }): Promise<CoachRefundRecord>;
}

export class CoachRefundError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "CoachRefundError";
  }
}

export class CoachRefundService {
  constructor(private readonly repository: CoachRefundRepository) {}

  async requestRefund(input: {
    bookingId: string;
    playerId: string;
    reason: string;
    now?: Date;
  }): Promise<CoachRefundRecord> {
    const now = input.now ?? new Date();
    const booking = await this.repository.getBooking(input.bookingId);
    if (!booking) throw new CoachRefundError("COACH_BOOKING_NOT_FOUND", "Booking not found");
    if (booking.playerId !== input.playerId) {
      throw new CoachRefundError("COACH_BOOKING_FORBIDDEN", "Not your booking");
    }
    if (booking.status !== "CONFIRMED") {
      throw new CoachRefundError(
        "REFUND_STATUS_INVALID",
        `Cannot refund a ${booking.status} booking`,
      );
    }
    const eligible = isRefundEligible({
      bookingStartsAt: booking.startsAt,
      requestedAt: now,
      cause: CancellationCause.Player,
    });
    if (!eligible) {
      throw new CoachRefundError(
        "REFUND_NOT_ELIGIBLE",
        "Refunds are only available at least seven days before the session",
      );
    }
    return this.repository.createRefundRequest({
      bookingId: booking.id,
      amount: booking.amount,
      reason: input.reason.trim(),
    });
  }

  async decideRefund(input: {
    refundId: string;
    decision: "APPROVED" | "REJECTED";
    now?: Date;
  }): Promise<CoachRefundRecord> {
    const refund = await this.repository.getRefund(input.refundId);
    if (!refund) throw new CoachRefundError("REFUND_NOT_FOUND", "Refund not found");
    if (refund.status !== "REQUESTED") {
      throw new CoachRefundError("REFUND_STATUS_INVALID", `Refund is already ${refund.status}`);
    }
    return this.repository.decideRefund({
      refundId: input.refundId,
      decision: input.decision,
      now: input.now ?? new Date(),
    });
  }

  async completeRefund(input: {
    refundId: string;
    channel: RefundChannel;
    transactionRef: string;
    now?: Date;
  }): Promise<CoachRefundRecord> {
    const refund = await this.repository.getRefund(input.refundId);
    if (!refund) throw new CoachRefundError("REFUND_NOT_FOUND", "Refund not found");
    if (refund.status !== "APPROVED") {
      throw new CoachRefundError(
        "REFUND_STATUS_INVALID",
        "Only approved refunds can be marked completed",
      );
    }
    return this.repository.completeRefund({
      refundId: input.refundId,
      channel: input.channel,
      transactionRef: input.transactionRef.trim(),
      now: input.now ?? new Date(),
    });
  }

  async cancelByCoach(input: { bookingId: string; reason: string }): Promise<CoachRefundRecord> {
    const booking = await this.repository.getBooking(input.bookingId);
    if (!booking) throw new CoachRefundError("COACH_BOOKING_NOT_FOUND", "Booking not found");
    if (booking.status !== "CONFIRMED" && booking.status !== "REFUND_REQUESTED") {
      throw new CoachRefundError(
        "REFUND_STATUS_INVALID",
        `Cannot cancel a ${booking.status} booking`,
      );
    }
    return this.repository.coachCancel({
      bookingId: booking.id,
      reason: input.reason.trim(),
      amount: booking.amount,
    });
  }
}
