import { describe, expect, it } from "vitest";
import {
  type CoachBookingForReview,
  type CourtBookingForReview,
  type RatingSummary,
  ReviewError,
  type ReviewRecord,
  type ReviewRepository,
  ReviewService,
  assertRating,
} from "./review.service.js";

class FakeReviewRepo implements ReviewRepository {
  court: CourtBookingForReview | null = null;
  coach: CoachBookingForReview | null = null;
  reviews: ReviewRecord[] = [];

  async getCourtBooking() {
    return this.court;
  }
  async getCoachBooking() {
    return this.coach;
  }
  async createCourtReview(input: {
    authorId: string;
    venueId: string;
    courtBookingId: string;
    rating: number;
    comment: string | null;
  }) {
    const r: ReviewRecord = {
      id: `r-${this.reviews.length + 1}`,
      authorId: input.authorId,
      venueId: input.venueId,
      coachId: null,
      rating: input.rating,
      comment: input.comment,
      createdAt: new Date(),
    };
    this.reviews.push(r);
    return r;
  }
  async createCoachReview(input: {
    authorId: string;
    coachId: string;
    coachBookingId: string;
    rating: number;
    comment: string | null;
  }) {
    const r: ReviewRecord = {
      id: `r-${this.reviews.length + 1}`,
      authorId: input.authorId,
      venueId: null,
      coachId: input.coachId,
      rating: input.rating,
      comment: input.comment,
      createdAt: new Date(),
    };
    this.reviews.push(r);
    return r;
  }
  async listVenueReviews() {
    return this.reviews.filter((r) => r.venueId);
  }
  async listCoachReviews() {
    return this.reviews.filter((r) => r.coachId);
  }
  async venueRating(): Promise<RatingSummary> {
    return { average: 0, count: 0 };
  }
  async coachRating(): Promise<RatingSummary> {
    return { average: 0, count: 0 };
  }
}

function courtBooking(overrides: Partial<CourtBookingForReview> = {}): CourtBookingForReview {
  return {
    id: "b1",
    playerId: "p1",
    status: "COMPLETED",
    venueId: "v1",
    reviewed: false,
    ...overrides,
  };
}

describe("assertRating", () => {
  it("accepts 1..5 integers and rejects others", () => {
    for (const r of [1, 2, 3, 4, 5]) expect(() => assertRating(r)).not.toThrow();
    expect(() => assertRating(0)).toThrow(ReviewError);
    expect(() => assertRating(6)).toThrow(ReviewError);
    expect(() => assertRating(3.5)).toThrow(ReviewError);
  });
});

describe("ReviewService.reviewCourtBooking", () => {
  it("creates a review for a completed booking owned by the author", async () => {
    const repo = new FakeReviewRepo();
    repo.court = courtBooking();
    const service = new ReviewService(repo);
    const review = await service.reviewCourtBooking({
      bookingId: "b1",
      authorId: "p1",
      rating: 5,
      comment: " great ",
    });
    expect(review.rating).toBe(5);
    expect(review.comment).toBe("great");
    expect(review.venueId).toBe("v1");
  });

  it("rejects reviews from non-owners", async () => {
    const repo = new FakeReviewRepo();
    repo.court = courtBooking();
    const service = new ReviewService(repo);
    await expect(
      service.reviewCourtBooking({ bookingId: "b1", authorId: "intruder", rating: 5 }),
    ).rejects.toMatchObject({ code: "REVIEW_FORBIDDEN" });
  });

  it("rejects reviews for bookings that are not completed", async () => {
    const repo = new FakeReviewRepo();
    repo.court = courtBooking({ status: "CONFIRMED" });
    const service = new ReviewService(repo);
    await expect(
      service.reviewCourtBooking({ bookingId: "b1", authorId: "p1", rating: 4 }),
    ).rejects.toMatchObject({ code: "REVIEW_NOT_COMPLETED" });
  });

  it("rejects a second review for the same booking", async () => {
    const repo = new FakeReviewRepo();
    repo.court = courtBooking({ reviewed: true });
    const service = new ReviewService(repo);
    await expect(
      service.reviewCourtBooking({ bookingId: "b1", authorId: "p1", rating: 4 }),
    ).rejects.toMatchObject({ code: "REVIEW_ALREADY_EXISTS" });
  });
});
