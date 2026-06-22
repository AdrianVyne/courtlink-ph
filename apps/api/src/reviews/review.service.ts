export interface ReviewRecord {
  id: string;
  authorId: string;
  venueId: string | null;
  coachId: string | null;
  rating: number;
  comment: string | null;
  createdAt: Date;
}

export interface RatingSummary {
  average: number;
  count: number;
}

export interface CourtBookingForReview {
  id: string;
  playerId: string;
  status: string;
  venueId: string;
  reviewed: boolean;
}

export interface CoachBookingForReview {
  id: string;
  playerId: string;
  status: string;
  coachId: string;
  reviewed: boolean;
}

export interface ReviewRepository {
  getCourtBooking(id: string): Promise<CourtBookingForReview | null>;
  getCoachBooking(id: string): Promise<CoachBookingForReview | null>;
  createCourtReview(input: {
    authorId: string;
    venueId: string;
    courtBookingId: string;
    rating: number;
    comment: string | null;
  }): Promise<ReviewRecord>;
  createCoachReview(input: {
    authorId: string;
    coachId: string;
    coachBookingId: string;
    rating: number;
    comment: string | null;
  }): Promise<ReviewRecord>;
  listVenueReviews(venueId: string, limit: number): Promise<ReviewRecord[]>;
  listCoachReviews(coachId: string, limit: number): Promise<ReviewRecord[]>;
  venueRating(venueId: string): Promise<RatingSummary>;
  coachRating(coachId: string): Promise<RatingSummary>;
}

export class ReviewError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "ReviewError";
  }
}

export function assertRating(rating: number): void {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ReviewError("REVIEW_RATING_INVALID", "Rating must be an integer from 1 to 5");
  }
}

export class ReviewService {
  constructor(private readonly repository: ReviewRepository) {}

  async reviewCourtBooking(input: {
    bookingId: string;
    authorId: string;
    rating: number;
    comment?: string | null;
  }): Promise<ReviewRecord> {
    assertRating(input.rating);
    const booking = await this.repository.getCourtBooking(input.bookingId);
    if (!booking) throw new ReviewError("BOOKING_NOT_FOUND", "Booking not found");
    if (booking.playerId !== input.authorId) {
      throw new ReviewError("REVIEW_FORBIDDEN", "Only the player can review this booking");
    }
    if (booking.status !== "COMPLETED") {
      throw new ReviewError("REVIEW_NOT_COMPLETED", "You can only review completed bookings");
    }
    if (booking.reviewed) {
      throw new ReviewError("REVIEW_ALREADY_EXISTS", "This booking is already reviewed");
    }
    return this.repository.createCourtReview({
      authorId: input.authorId,
      venueId: booking.venueId,
      courtBookingId: booking.id,
      rating: input.rating,
      comment: input.comment?.trim() || null,
    });
  }

  async reviewCoachBooking(input: {
    bookingId: string;
    authorId: string;
    rating: number;
    comment?: string | null;
  }): Promise<ReviewRecord> {
    assertRating(input.rating);
    const booking = await this.repository.getCoachBooking(input.bookingId);
    if (!booking) throw new ReviewError("BOOKING_NOT_FOUND", "Booking not found");
    if (booking.playerId !== input.authorId) {
      throw new ReviewError("REVIEW_FORBIDDEN", "Only the player can review this booking");
    }
    if (booking.status !== "COMPLETED") {
      throw new ReviewError("REVIEW_NOT_COMPLETED", "You can only review completed bookings");
    }
    if (booking.reviewed) {
      throw new ReviewError("REVIEW_ALREADY_EXISTS", "This booking is already reviewed");
    }
    return this.repository.createCoachReview({
      authorId: input.authorId,
      coachId: booking.coachId,
      coachBookingId: booking.id,
      rating: input.rating,
      comment: input.comment?.trim() || null,
    });
  }

  listVenueReviews(venueId: string, limit = 20): Promise<ReviewRecord[]> {
    return this.repository.listVenueReviews(venueId, limit);
  }

  listCoachReviews(coachId: string, limit = 20): Promise<ReviewRecord[]> {
    return this.repository.listCoachReviews(coachId, limit);
  }

  venueRating(venueId: string): Promise<RatingSummary> {
    return this.repository.venueRating(venueId);
  }

  coachRating(coachId: string): Promise<RatingSummary> {
    return this.repository.coachRating(coachId);
  }
}
