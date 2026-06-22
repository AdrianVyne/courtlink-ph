import { BookingStatus } from "@courtlink/database";
import type { PaymentChannel, PaymentProofStatus } from "@courtlink/database";
import type { PrismaClient } from "@courtlink/database";
import {
  BookingError,
  type BookingRecord,
  type BookingRepository,
  type BookingStatus as ServiceBookingStatus,
  type PaymentChannel as ServicePaymentChannel,
  type PaymentSubmissionRecord,
} from "./booking.service.js";
import { ScheduleError, validateScheduledInterval } from "./availability-policy.js";
import { toCourtSummary } from "./court.service.js";

type PrismaBookingShape = {
  id: string;
  courtId: string;
  playerId: string;
  status: BookingStatus;
  startsAt: Date;
  endsAt: Date;
  quotedAmount: { toString(): string } | number | string;
  currency: string;
  proofDeadline: Date;
  reviewDueAt: Date | null;
  createdAt: Date;
};

function toRecord(row: PrismaBookingShape): BookingRecord {
  return {
    id: row.id,
    courtId: row.courtId,
    playerId: row.playerId,
    status: row.status as ServiceBookingStatus,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    quotedAmount: Number(row.quotedAmount),
    currency: row.currency as "PHP",
    proofDeadline: row.proofDeadline,
    reviewDueAt: row.reviewDueAt ?? null,
    createdAt: row.createdAt,
  };
}

function toSubmission(row: {
  id: string;
  bookingId: string;
  channel: PaymentChannel;
  transactionRef: string;
  proofObjectKey: string;
  status: PaymentProofStatus;
}): PaymentSubmissionRecord {
  return {
    id: row.id,
    bookingId: row.bookingId,
    channel: row.channel as ServicePaymentChannel["value"],
    transactionRef: row.transactionRef,
    proofObjectKey: row.proofObjectKey,
    status: row.status as PaymentSubmissionRecord["status"],
  };
}

export class PrismaBookingRepository implements BookingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createHold(input: {
    courtId: string;
    playerId: string;
    startsAt: Date;
    endsAt: Date;
    quotedAmount: number;
    proofDeadline: Date;
  }): Promise<BookingRecord> {
    try {
      const booking = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${input.courtId}, 0)) IS NULL AS "locked"
        `;
        const court = await tx.court.findUniqueOrThrow({
          where: { id: input.courtId },
          include: {
            operatingHours: true,
            closures: {
              where: { startsAt: { lt: input.endsAt }, endsAt: { gt: input.startsAt } },
            },
          },
        });
        validateScheduledInterval(
          toCourtSummary(court),
          court.operatingHours,
          court.closures,
          input.startsAt,
          input.endsAt,
        );
        return tx.courtBooking.create({
          data: {
            courtId: input.courtId,
            playerId: input.playerId,
            status: BookingStatus.HELD,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            quotedAmount: input.quotedAmount.toFixed(2),
            proofDeadline: input.proofDeadline,
          },
        });
      });
      return toRecord(booking);
    } catch (error) {
      if (error instanceof ScheduleError) throw error;
      if (isActiveOverlapError(error)) {
        throw new BookingError("COURT_BOOKING_CONFLICT", "Court slot is no longer available");
      }
      throw error;
    }
  }

  async getSubmission(
    id: string,
  ): Promise<{ id: string; bookingId: string; proofObjectKey: string } | null> {
    const submission = await this.prisma.courtPaymentSubmission.findUnique({ where: { id } });
    if (!submission) return null;
    return {
      id: submission.id,
      bookingId: submission.bookingId,
      proofObjectKey: submission.proofObjectKey,
    };
  }

  async getBooking(id: string): Promise<BookingRecord | null> {
    const booking = await this.prisma.courtBooking.findUnique({ where: { id } });
    return booking ? toRecord(booking) : null;
  }

  async transitionStatus(
    id: string,
    expected: ServiceBookingStatus,
    next: ServiceBookingStatus,
    extras?: { reviewDueAt?: Date | null },
  ): Promise<BookingRecord> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.courtBooking.findUniqueOrThrow({ where: { id } });
      if (current.status !== expected) {
        throw new Error(`BOOKING_STATUS_CONFLICT:${current.status}`);
      }
      const row = await tx.courtBooking.update({
        where: { id },
        data: {
          status: next as BookingStatus,
          ...(extras?.reviewDueAt === undefined ? {} : { reviewDueAt: extras.reviewDueAt }),
        },
      });
      return row;
    });
    return toRecord(updated);
  }

  async submitPayment(input: {
    bookingId: string;
    channel: ServicePaymentChannel["value"];
    transactionRef: string;
    proofObjectKey: string;
  }): Promise<PaymentSubmissionRecord> {
    const submission = await this.prisma.courtPaymentSubmission.create({
      data: {
        bookingId: input.bookingId,
        channel: input.channel as PaymentChannel,
        transactionRef: input.transactionRef,
        proofObjectKey: input.proofObjectKey,
      },
    });
    return toSubmission(submission);
  }

  async decidePayment(input: {
    submissionId: string;
    decision: "APPROVED" | "REJECTED";
    reviewedById: string;
    reason: string | null;
  }): Promise<PaymentSubmissionRecord> {
    const submission = await this.prisma.courtPaymentSubmission.update({
      where: { id: input.submissionId },
      data: {
        status: input.decision as PaymentProofStatus,
        reviewedAt: new Date(),
        reviewedById: input.reviewedById,
        reviewReason: input.reason,
      },
    });
    return toSubmission(submission);
  }

  async expireStaleHolds(now: Date): Promise<number> {
    const result = await this.prisma.courtBooking.updateMany({
      where: { status: BookingStatus.HELD, proofDeadline: { lt: now } },
      data: { status: BookingStatus.EXPIRED },
    });
    return result.count;
  }
}

function isActiveOverlapError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message) : "";
  return (
    code === "23P01" ||
    message.includes("court_bookings_no_active_overlap") ||
    message.includes("23P01")
  );
}
