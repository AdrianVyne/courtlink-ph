import type { PrismaClient } from "@courtlink/database";
import {
  type AcceptOfferResult,
  type CoachBookingRecord,
  CoachMarketError,
  type CoachMarketRepository,
  type CoachOfferRecord,
  type CoachRequestRecord,
  type CreateOfferInput,
  type CreateRequestInput,
} from "./coach-market.service.js";

type RequestRow = {
  id: string;
  playerId: string;
  targetCoachId: string | null;
  status: string;
  startsAt: Date;
  endsAt: Date;
  location: string;
  groupSize: number;
  skillLevel: string;
  goals: string | null;
  notes: string | null;
};

type OfferRow = {
  id: string;
  requestId: string;
  coachId: string;
  status: string;
  amount: { toString(): string } | number | string;
  message: string | null;
  expiresAt: Date;
};

function toRequest(row: RequestRow): CoachRequestRecord {
  return {
    id: row.id,
    playerId: row.playerId,
    targetCoachId: row.targetCoachId,
    status: row.status as CoachRequestRecord["status"],
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    location: row.location,
    groupSize: row.groupSize,
    skillLevel: row.skillLevel,
    goals: row.goals,
    notes: row.notes,
  };
}

function toOffer(row: OfferRow): CoachOfferRecord {
  return {
    id: row.id,
    requestId: row.requestId,
    coachId: row.coachId,
    status: row.status as CoachOfferRecord["status"],
    amount: Number(row.amount),
    message: row.message,
    expiresAt: row.expiresAt,
  };
}

export class PrismaCoachMarketRepository implements CoachMarketRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createRequest(input: CreateRequestInput): Promise<CoachRequestRecord> {
    const request = await this.prisma.coachRequest.create({
      data: {
        playerId: input.playerId,
        targetCoachId: input.targetCoachId ?? null,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        location: input.location,
        groupSize: input.groupSize,
        skillLevel: input.skillLevel,
        goals: input.goals ?? null,
        notes: input.notes ?? null,
      },
    });
    return toRequest(request);
  }

  async getRequest(id: string): Promise<CoachRequestRecord | null> {
    const request = await this.prisma.coachRequest.findUnique({ where: { id } });
    return request ? toRequest(request) : null;
  }

  async listOpenRequests(limit: number): Promise<CoachRequestRecord[]> {
    const requests = await this.prisma.coachRequest.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return requests.map(toRequest);
  }

  async createOffer(input: CreateOfferInput): Promise<CoachOfferRecord> {
    const offer = await this.prisma.coachOffer.create({
      data: {
        requestId: input.requestId,
        coachId: input.coachId,
        amount: input.amount.toFixed(2),
        message: input.message ?? null,
        expiresAt: input.expiresAt,
      },
    });
    return toOffer(offer);
  }

  async getOffer(id: string): Promise<CoachOfferRecord | null> {
    const offer = await this.prisma.coachOffer.findUnique({ where: { id } });
    return offer ? toOffer(offer) : null;
  }

  async listOffersForRequest(requestId: string): Promise<CoachOfferRecord[]> {
    const offers = await this.prisma.coachOffer.findMany({
      where: { requestId },
      orderBy: { createdAt: "asc" },
    });
    return offers.map(toOffer);
  }

  async listOffersForCoach(coachId: string): Promise<CoachOfferRecord[]> {
    const offers = await this.prisma.coachOffer.findMany({
      where: { coachId },
      orderBy: { createdAt: "desc" },
    });
    return offers.map(toOffer);
  }

  async acceptOfferTransactionally(input: {
    offerId: string;
    now: Date;
    proofDeadline: Date;
  }): Promise<AcceptOfferResult> {
    const result = await this.prisma.$transaction(async (tx) => {
      const offer = await tx.coachOffer.findUniqueOrThrow({ where: { id: input.offerId } });
      if (offer.status !== "ACTIVE" || offer.expiresAt <= input.now) {
        throw new CoachMarketError("OFFER_NOT_ACCEPTABLE", "Offer expired or inactive");
      }
      const existing = await tx.coachRequest.findUniqueOrThrow({ where: { id: offer.requestId } });
      if (existing.status !== "OPEN") {
        throw new CoachMarketError("REQUEST_NOT_OPEN", `Request is ${existing.status}`);
      }

      await tx.coachOffer.update({ where: { id: offer.id }, data: { status: "ACCEPTED" } });
      await tx.coachOffer.updateMany({
        where: { requestId: existing.id, status: "ACTIVE", id: { not: offer.id } },
        data: { status: "REJECTED" },
      });
      const matchedRequest = await tx.coachRequest.update({
        where: { id: existing.id },
        data: { status: "MATCHED" },
      });

      const booking = await tx.coachBooking.create({
        data: {
          requestId: existing.id,
          offerId: offer.id,
          coachId: offer.coachId,
          playerId: existing.playerId,
          status: "HELD",
          startsAt: existing.startsAt,
          endsAt: existing.endsAt,
          location: existing.location,
          amount: offer.amount,
          proofDeadline: input.proofDeadline,
        },
      });

      return { booking, request: matchedRequest };
    });

    const booking: CoachBookingRecord = {
      id: result.booking.id,
      requestId: result.booking.requestId,
      offerId: result.booking.offerId,
      coachId: result.booking.coachId,
      playerId: result.booking.playerId,
      status: result.booking.status as CoachBookingRecord["status"],
      startsAt: result.booking.startsAt,
      endsAt: result.booking.endsAt,
      location: result.booking.location,
      amount: Number(result.booking.amount),
      currency: "PHP",
      proofDeadline: result.booking.proofDeadline,
      reviewDueAt: result.booking.reviewDueAt,
    };
    return { booking, request: toRequest(result.request) };
  }
}
