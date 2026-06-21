import { CancellationCause, isRefundEligible } from "@courtlink/domain";

export type RefundStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "COMPLETED";
export type RefundChannel = "GCASH" | "MAYA" | "QR_PH" | "BANK_TRANSFER" | "OTHER";

export interface RefundRecord {
  id: string;
  bookingId: string;
  status: RefundStatus;
  amount: number;
  reason: string;
  channel: RefundChannel | null;
  transactionRef: string | null;
}

export interface RefundBookingView {
  id: string;
  playerId: string;
  courtId: string;
  status: string;
  startsAt: Date;
  quotedAmount: number;
}

export interface RefundRepository {
  getBooking(id: string): Promise<RefundBookingView | null>;
  getRefund(id: string): Promise<RefundRecord | null>;
  createRefundRequest(input: {
    bookingId: string;
    amount: number;
    reason: string;
  }): Promise<RefundRecord>;
  decideRefund(input: {
    refundId: string;
    decision: "APPROVED" | "REJECTED";
    now: Date;
  }): Promise<RefundRecord>;
  completeRefund(input: {
    refundId: string;
    channel: RefundChannel;
    transactionRef: string;
    now: Date;
  }): Promise<RefundRecord>;
  venueCancel(input: { bookingId: string; reason: string; amount: number }): Promise<RefundRecord>;
}

export class RefundError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "RefundError";
  }
}

export class RefundService {
  constructor(private readonly repository: RefundRepository) {}

  async requestRefund(input: {
    bookingId: string;
    playerId: string;
    reason: string;
    now?: Date;
  }): Promise<RefundRecord> {
    const now = input.now ?? new Date();
    const booking = await this.repository.getBooking(input.bookingId);
    if (!booking) throw new RefundError("BOOKING_NOT_FOUND", "Booking not found");
    if (booking.playerId !== input.playerId) {
      throw new RefundError("BOOKING_FORBIDDEN", "Not your booking");
    }
    if (booking.status !== "CONFIRMED") {
      throw new RefundError("REFUND_STATUS_INVALID", `Cannot refund a ${booking.status} booking`);
    }
    const eligible = isRefundEligible({
      bookingStartsAt: booking.startsAt,
      requestedAt: now,
      cause: CancellationCause.Player,
    });
    if (!eligible) {
      throw new RefundError(
        "REFUND_NOT_ELIGIBLE",
        "Refunds are only available at least seven days before the booking",
      );
    }
    return this.repository.createRefundRequest({
      bookingId: booking.id,
      amount: booking.quotedAmount,
      reason: input.reason.trim(),
    });
  }

  async decideRefund(input: {
    refundId: string;
    decision: "APPROVED" | "REJECTED";
    now?: Date;
  }): Promise<RefundRecord> {
    const refund = await this.repository.getRefund(input.refundId);
    if (!refund) throw new RefundError("REFUND_NOT_FOUND", "Refund not found");
    if (refund.status !== "REQUESTED") {
      throw new RefundError("REFUND_STATUS_INVALID", `Refund is already ${refund.status}`);
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
  }): Promise<RefundRecord> {
    const refund = await this.repository.getRefund(input.refundId);
    if (!refund) throw new RefundError("REFUND_NOT_FOUND", "Refund not found");
    if (refund.status !== "APPROVED") {
      throw new RefundError(
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

  async cancelByVenue(input: { bookingId: string; reason: string }): Promise<RefundRecord> {
    const booking = await this.repository.getBooking(input.bookingId);
    if (!booking) throw new RefundError("BOOKING_NOT_FOUND", "Booking not found");
    if (booking.status !== "CONFIRMED" && booking.status !== "REFUND_REQUESTED") {
      throw new RefundError("REFUND_STATUS_INVALID", `Cannot cancel a ${booking.status} booking`);
    }
    return this.repository.venueCancel({
      bookingId: booking.id,
      reason: input.reason.trim(),
      amount: booking.quotedAmount,
    });
  }
}
