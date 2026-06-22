import { BookingStatus, type PrismaClient, RefundStatus } from "@courtlink/database";
import type {
  CoachRefundBookingView,
  CoachRefundRecord,
  CoachRefundRepository,
  RefundChannel,
} from "./coach-refund.service.js";

type RefundRow = {
  id: string;
  bookingId: string;
  status: RefundStatus;
  amount: { toString(): string } | number | string;
  reason: string;
  channel: string | null;
  transactionRef: string | null;
};

function toRefund(row: RefundRow): CoachRefundRecord {
  return {
    id: row.id,
    bookingId: row.bookingId,
    status: row.status as CoachRefundRecord["status"],
    amount: Number(row.amount),
    reason: row.reason,
    channel: (row.channel as RefundChannel | null) ?? null,
    transactionRef: row.transactionRef,
  };
}

export class PrismaCoachRefundRepository implements CoachRefundRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getBooking(id: string): Promise<CoachRefundBookingView | null> {
    const booking = await this.prisma.coachBooking.findUnique({ where: { id } });
    if (!booking) return null;
    return {
      id: booking.id,
      playerId: booking.playerId,
      coachId: booking.coachId,
      status: booking.status,
      startsAt: booking.startsAt,
      amount: Number(booking.amount),
    };
  }

  async getRefund(id: string): Promise<CoachRefundRecord | null> {
    const refund = await this.prisma.coachRefund.findUnique({ where: { id } });
    return refund ? toRefund(refund) : null;
  }

  async createRefundRequest(input: {
    bookingId: string;
    amount: number;
    reason: string;
  }): Promise<CoachRefundRecord> {
    const refund = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.coachBooking.findUniqueOrThrow({ where: { id: input.bookingId } });
      if (booking.status !== BookingStatus.CONFIRMED) {
        throw new Error(`REFUND_STATUS_CONFLICT:${booking.status}`);
      }
      const created = await tx.coachRefund.create({
        data: {
          bookingId: input.bookingId,
          amount: input.amount.toFixed(2),
          reason: input.reason,
          status: RefundStatus.REQUESTED,
        },
      });
      await tx.coachBooking.update({
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
  }): Promise<CoachRefundRecord> {
    const refund = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.coachRefund.findUniqueOrThrow({ where: { id: input.refundId } });
      if (existing.status !== RefundStatus.REQUESTED) {
        throw new Error(`REFUND_STATUS_CONFLICT:${existing.status}`);
      }
      const updated = await tx.coachRefund.update({
        where: { id: input.refundId },
        data: {
          status: input.decision === "APPROVED" ? RefundStatus.APPROVED : RefundStatus.REJECTED,
          decidedAt: input.now,
        },
      });
      await tx.coachBooking.update({
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
  }): Promise<CoachRefundRecord> {
    const refund = await this.prisma.coachRefund.update({
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

  async coachCancel(input: {
    bookingId: string;
    reason: string;
    amount: number;
  }): Promise<CoachRefundRecord> {
    const refund = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.coachBooking.findUniqueOrThrow({ where: { id: input.bookingId } });
      if (
        booking.status !== BookingStatus.CONFIRMED &&
        booking.status !== BookingStatus.REFUND_REQUESTED
      ) {
        throw new Error(`REFUND_STATUS_CONFLICT:${booking.status}`);
      }
      const created = await tx.coachRefund.create({
        data: {
          bookingId: input.bookingId,
          amount: input.amount.toFixed(2),
          reason: input.reason,
          status: RefundStatus.APPROVED,
          decidedAt: new Date(),
        },
      });
      await tx.coachBooking.update({
        where: { id: input.bookingId },
        data: { status: BookingStatus.CANCELLED },
      });
      return created;
    });
    return toRefund(refund);
  }
}
