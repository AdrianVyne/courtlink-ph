import type { PrismaClient } from "@courtlink/database";
import type { BookingListItem, BookingQueryRepository } from "./booking-query.service.js";

type BookingWithRelations = {
  id: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  quotedAmount: { toString(): string } | number | string;
  currency: string;
  proofDeadline: Date | null;
  reviewDueAt: Date | null;
  court: { id: string; name: string; venue: { id: string; name: string; slug: string } };
  payments: Array<{
    id: string;
    status: string;
    channel: string;
    transactionRef: string;
    proofObjectKey: string;
  }>;
  refunds: Array<{ id: string; status: string; amount: { toString(): string } | number | string }>;
};

const include = {
  court: { include: { venue: true } },
  payments: { orderBy: { submittedAt: "desc" }, take: 1 },
  refunds: { orderBy: { requestedAt: "desc" }, take: 1 },
} as const;

function toItem(row: BookingWithRelations): BookingListItem {
  const submission = row.payments[0];
  const refund = row.refunds[0];
  return {
    id: row.id,
    status: row.status,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    quotedAmount: Number(row.quotedAmount),
    currency: row.currency,
    proofDeadline: row.proofDeadline ? row.proofDeadline.toISOString() : null,
    reviewDueAt: row.reviewDueAt ? row.reviewDueAt.toISOString() : null,
    court: { id: row.court.id, name: row.court.name },
    venue: { id: row.court.venue.id, name: row.court.venue.name, slug: row.court.venue.slug },
    submission: submission
      ? {
          id: submission.id,
          status: submission.status,
          channel: submission.channel,
          transactionRef: submission.transactionRef,
          proofObjectKey: submission.proofObjectKey,
        }
      : null,
    refund: refund ? { id: refund.id, status: refund.status, amount: Number(refund.amount) } : null,
  };
}

export class PrismaBookingQueryRepository implements BookingQueryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listForPlayer(playerId: string): Promise<BookingListItem[]> {
    const rows = await this.prisma.courtBooking.findMany({
      where: { playerId },
      include,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map((row) => toItem(row as unknown as BookingWithRelations));
  }

  async listForVenues(venueIds: string[], statuses: string[]): Promise<BookingListItem[]> {
    const rows = await this.prisma.courtBooking.findMany({
      where: {
        court: { venueId: { in: venueIds } },
        status: { in: statuses as never },
      },
      include,
      orderBy: { startsAt: "asc" },
      take: 200,
    });
    return rows.map((row) => toItem(row as unknown as BookingWithRelations));
  }
}
