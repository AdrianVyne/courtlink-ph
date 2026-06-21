import { BookingStatus, type PrismaClient, RefundStatus } from "@courtlink/database";
import type {
  RefundBookingView,
  RefundChannel,
  RefundRecord,
  RefundRepository,
} from "./refund.service.js";

type RefundRow = {
  id: string;
  bookingId: string;
  status: RefundStatus;
  amount: { toString(): string } | number | string;
  reason: string;
  channel: string | null;
  transactionRef: string | null;
};

function toRefund(row: RefundRow): RefundRecord {
  return {
    id: row.id,
    bookingId: row.bookingId,
    status: row.status as RefundRecord["status"],
    amount: Number(row.amount),
    reason: row.reason,
    channel: (row.channel as RefundChannel | null) ?? null,
    transactionRef: row.transactionRef,
  };
}

export class PrismaRefundRepository implements RefundRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getBooking(id: string): Promise<RefundBookingView | null> {
    const booking = await this.prisma.courtBooking.findUnique({ where: { id } });
    if (!booking) return null;
    return {
      id: booking.id,
      playerId: booking.playerId,
      courtId: booking.courtId,
      status: booking.status,
      startsAt: booking.startsAt,
      quotedAmount: Number(booking.quotedAmount),
    };
  }

  async getRefund(id: string): Promise<RefundRecord | null> {
    const refund = await this.prisma.courtRefund.findUnique({ where: { id } });
    return refund ? toRefund(refund) : null;
  }

  async createRefundRequest(input: {
    bookingId: string;
    amount: number;
    reason: string;
  }): Promise<RefundRecord> {
    const refund = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.courtBooking.findUniqueOrThrow({ where: { id: input.bookingId } });
      if (booking.status !== BookingStatus.CONFIRMED) {
        throw new Error(`REFUND_STATUS_CONFLICT:${booking.status}`);
      }
      const created = await tx.courtRefund.create({
        data: {
          bookingId: input.bookingId,
          amount: input.amount.toFixed(2),
          reason: input.reason,
          status: RefundStatus.REQUESTED,
        },
      });
      await tx.courtBooking.update({
        where: { id: input.bookingId },
        data: { status: BookingStatus.REFUND_REQUESTED },
      });
      return created;
    });
    return toRefund(refund);
  }

  async decideRefund(input: {
    refundId: string;
    decision: "APPROVED" | "REJECTED";
    now: Date;
  }): Promise<RefundRecord> {
    const refund = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.courtRefund.findUniqueOrThrow({ where: { id: input.refundId } });
      if (existing.status !== RefundStatus.REQUESTED) {
        throw new Error(`REFUND_STATUS_CONFLICT:${existing.status}`);
      }
      const updated = await tx.courtRefund.update({
        where: { id: input.refundId },
        data: {
          status: input.decision === "APPROVED" ? RefundStatus.APPROVED : RefundStatus.REJECTED,
          decidedAt: input.now,
        },
      });
      await tx.courtBooking.update({
        where: { id: existing.bookingId },
        data: {
          status: input.decision === "APPROVED" ? BookingStatus.CANCELLED : BookingStatus.CONFIRMED,
        },
      });
      return updated;
    });
    return toRefund(refund);
  }

  async completeRefund(input: {
    refundId: string;
    channel: RefundChannel;
    transactionRef: string;
    now: Date;
  }): Promise<RefundRecord> {
    const refund = await this.prisma.courtRefund.update({
      where: { id: input.refundId },
      data: {
        status: RefundStatus.COMPLETED,
        channel: input.channel,
        transactionRef: input.transactionRef,
        completedAt: input.now,
      },
    });
    return toRefund(refund);
  }

  async venueCancel(input: {
    bookingId: string;
    reason: string;
    amount: number;
  }): Promise<RefundRecord> {
    const refund = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.courtBooking.findUniqueOrThrow({ where: { id: input.bookingId } });
      if (
        booking.status !== BookingStatus.CONFIRMED &&
        booking.status !== BookingStatus.REFUND_REQUESTED
      ) {
        throw new Error(`REFUND_STATUS_CONFLICT:${booking.status}`);
      }
      const created = await tx.courtRefund.create({
        data: {
          bookingId: input.bookingId,
          amount: input.amount.toFixed(2),
          reason: input.reason,
          status: RefundStatus.APPROVED,
          decidedAt: new Date(),
        },
      });
      await tx.courtBooking.update({
        where: { id: input.bookingId },
        data: { status: BookingStatus.CANCELLED, cancellationCause: "venue" },
      });
      return created;
    });
    return toRefund(refund);
  }
}
