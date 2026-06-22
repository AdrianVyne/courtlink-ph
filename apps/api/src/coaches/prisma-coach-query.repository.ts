import type { PrismaClient } from "@courtlink/database";
import type {
  CoachBookingListItem,
  CoachQueryRepository,
  DirectedRequestItem,
  PlayerCoachRequestItem,
} from "./coach-query.service.js";

export class PrismaCoachQueryRepository implements CoachQueryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listDirectedPendingForCoach(coachId: string): Promise<DirectedRequestItem[]> {
    const rows = await this.prisma.coachRequest.findMany({
      where: { targetCoachId: coachId, status: "PENDING_COACH" },
      include: { player: { select: { displayName: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      location: row.location,
      groupSize: row.groupSize,
      skillLevel: row.skillLevel,
      goals: row.goals,
      notes: row.notes,
      player: { displayName: row.player.displayName },
    }));
  }

  async listBookingsForCoach(coachId: string): Promise<CoachBookingListItem[]> {
    const rows = await this.prisma.coachBooking.findMany({
      where: { coachId },
      include: {
        player: { select: { displayName: true } },
        payments: { orderBy: { submittedAt: "desc" }, take: 1 },
      },
      orderBy: { startsAt: "asc" },
      take: 100,
    });
    return rows.map((row) => {
      const submission = row.payments[0];
      return {
        id: row.id,
        status: row.status,
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        location: row.location,
        amount: Number(row.amount),
        currency: row.currency,
        player: { displayName: row.player.displayName },
        submission: submission
          ? {
              id: submission.id,
              status: submission.status,
              channel: submission.channel,
              transactionRef: submission.transactionRef,
            }
          : null,
      };
    });
  }

  async listRequestsForPlayer(playerId: string): Promise<PlayerCoachRequestItem[]> {
    const rows = await this.prisma.coachRequest.findMany({
      where: { playerId },
      include: {
        offers: { orderBy: { createdAt: "asc" } },
        booking: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      location: row.location,
      groupSize: row.groupSize,
      skillLevel: row.skillLevel,
      offers: row.offers.map((offer) => ({
        id: offer.id,
        coachId: offer.coachId,
        amount: Number(offer.amount),
        status: offer.status,
        expiresAt: offer.expiresAt.toISOString(),
        message: offer.message,
      })),
      booking: row.booking ? { id: row.booking.id, status: row.booking.status } : null,
    }));
  }
}
