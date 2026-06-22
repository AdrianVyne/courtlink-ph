import type { PrismaClient } from "@courtlink/database";
import type {
  CoachBookingForReview,
  CourtBookingForReview,
  RatingSummary,
  ReviewRecord,
  ReviewRepository,
} from "./review.service.js";

type ReviewRow = {
  id: string;
  authorId: string;
  venueId: string | null;
  coachId: string | null;
  rating: number;
  comment: string | null;
  createdAt: Date;
};

function toRecord(row: ReviewRow): ReviewRecord {
  return {
    id: row.id,
    authorId: row.authorId,
    venueId: row.venueId,
    coachId: row.coachId,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.createdAt,
  };
}

export class PrismaReviewRepository implements ReviewRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getCourtBooking(id: string): Promise<CourtBookingForReview | null> {
    const booking = await this.prisma.courtBooking.findUnique({
      where: { id },
      select: {
        id: true,
        playerId: true,
        status: true,
        court: { select: { venueId: true } },
        review: { select: { id: true } },
      },
    });
    if (!booking) return null;
    return {
      id: booking.id,
      playerId: booking.playerId,
      status: booking.status,
      venueId: booking.court.venueId,
      reviewed: booking.review !== null,
    };
  }

  async getCoachBooking(id: string): Promise<CoachBookingForReview | null> {
    const booking = await this.prisma.coachBooking.findUnique({
      where: { id },
      select: {
        id: true,
        playerId: true,
        status: true,
        coachId: true,
        review: { select: { id: true } },
      },
    });
    if (!booking) return null;
    return {
      id: booking.id,
      playerId: booking.playerId,
      status: booking.status,
      coachId: booking.coachId,
      reviewed: booking.review !== null,
    };
  }

  async createCourtReview(input: {
    authorId: string;
    venueId: string;
    courtBookingId: string;
    rating: number;
    comment: string | null;
  }): Promise<ReviewRecord> {
    const review = await this.prisma.review.create({
      data: {
        authorId: input.authorId,
        venueId: input.venueId,
        courtBookingId: input.courtBookingId,
        rating: input.rating,
        comment: input.comment,
      },
    });
    return toRecord(review);
  }

  async createCoachReview(input: {
    authorId: string;
    coachId: string;
    coachBookingId: string;
    rating: number;
    comment: string | null;
  }): Promise<ReviewRecord> {
    const review = await this.prisma.review.create({
      data: {
        authorId: input.authorId,
        coachId: input.coachId,
        coachBookingId: input.coachBookingId,
        rating: input.rating,
        comment: input.comment,
      },
    });
    return toRecord(review);
  }

  async listVenueReviews(venueId: string, limit: number): Promise<ReviewRecord[]> {
    const rows = await this.prisma.review.findMany({
      where: { venueId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(toRecord);
  }

  async listCoachReviews(coachId: string, limit: number): Promise<ReviewRecord[]> {
    const rows = await this.prisma.review.findMany({
      where: { coachId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(toRecord);
  }

  async venueRating(venueId: string): Promise<RatingSummary> {
    const result = await this.prisma.review.aggregate({
      where: { venueId },
      _avg: { rating: true },
      _count: { _all: true },
    });
    return { average: round1(result._avg.rating ?? 0), count: result._count._all };
  }

  async coachRating(coachId: string): Promise<RatingSummary> {
    const result = await this.prisma.review.aggregate({
      where: { coachId },
      _avg: { rating: true },
      _count: { _all: true },
    });
    return { average: round1(result._avg.rating ?? 0), count: result._count._all };
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
