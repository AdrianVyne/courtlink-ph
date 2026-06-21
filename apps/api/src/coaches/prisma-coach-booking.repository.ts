import type { PrismaClient } from "@courtlink/database";
import type { CoachBookingRecord, CoachBookingStatus } from "./coach-market.service.js";
import type { CoachBookingRepository, CoachPaymentRecord } from "./coach-booking.service.js";

type BookingRow = {
  id: string;
  requestId: string;
  offerId: string;
  coachId: string;
  playerId: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  location: string;
  amount: { toString(): string } | number | string;
  currency: string;
  proofDeadline: Date | null;
  reviewDueAt: Date | null;
};

function toBooking(row: BookingRow): CoachBookingRecord {
  return {
    id: row.id,
    requestId: row.requestId,
    offerId: row.offerId,
    coachId: row.coachId,
    playerId: row.playerId,
    status: row.status as CoachBookingRecord["status"],
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    location: row.location,
    amount: Number(row.amount),
    currency: "PHP",
    proofDeadline: row.proofDeadline,
    reviewDueAt: row.reviewDueAt,
  };
}

export class PrismaCoachBookingRepository implements CoachBookingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getBooking(id: string): Promise<CoachBookingRecord | null> {
    const booking = await this.prisma.coachBooking.findUnique({ where: { id } });
    return booking ? toBooking(booking) : null;
  }

  async transitionStatus(
    id: string,
    expected: CoachBookingStatus,
    next: CoachBookingStatus,
    extras?: { reviewDueAt?: Date | null },
  ): Promise<CoachBookingRecord> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.coachBooking.findUniqueOrThrow({ where: { id } });
      if (current.status !== expected) {
        throw new Error(`COACH_BOOKING_STATUS_CONFLICT:${current.status}`);
      }
      return tx.coachBooking.update({
        where: { id },
        data: {
          status: next,
          ...(extras?.reviewDueAt === undefined ? {} : { reviewDueAt: extras.reviewDueAt }),
        },
      });
    });
    return toBooking(updated);
  }

  async submitPayment(input: {
    bookingId: string;
    channel: CoachPaymentRecord["channel"];
    transactionRef: string;
    proofObjectKey: string;
  }): Promise<CoachPaymentRecord> {
    const submission = await this.prisma.coachPaymentSubmission.create({
      data: {
        bookingId: input.bookingId,
        channel: input.channel,
        transactionRef: input.transactionRef,
        proofObjectKey: input.proofObjectKey,
      },
    });
    return {
      id: submission.id,
      bookingId: submission.bookingId,
      channel: submission.channel as CoachPaymentRecord["channel"],
      transactionRef: submission.transactionRef,
      proofObjectKey: submission.proofObjectKey,
      status: submission.status as CoachPaymentRecord["status"],
    };
  }

  async decidePayment(input: {
    submissionId: string;
    decision: "APPROVED" | "REJECTED";
    reason: string | null;
  }): Promise<CoachPaymentRecord> {
    const submission = await this.prisma.coachPaymentSubmission.update({
      where: { id: input.submissionId },
      data: {
        status: input.decision,
        reviewedAt: new Date(),
        reviewReason: input.reason,
      },
    });
    return {
      id: submission.id,
      bookingId: submission.bookingId,
      channel: submission.channel as CoachPaymentRecord["channel"],
      transactionRef: submission.transactionRef,
      proofObjectKey: submission.proofObjectKey,
      status: submission.status as CoachPaymentRecord["status"],
    };
  }
}
