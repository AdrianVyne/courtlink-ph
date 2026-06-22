import { Body, Controller, Get, HttpCode, Param, Post, Req } from "@nestjs/common";
import { z } from "zod";
import { type AuthenticatedRequest, Public, getSessionUser } from "../auth/session.guard.js";
// biome-ignore lint/style/useImportType: ReviewService is injected at runtime by Nest.
import { ReviewService } from "./review.service.js";

const reviewSchema = z.object({
  bookingId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().nullable(),
});

@Controller({ path: "reviews", version: "1" })
export class ReviewController {
  constructor(private readonly reviews: ReviewService) {}

  @Public()
  @Get("venues/:venueId")
  async venueReviews(@Param("venueId") venueId: string) {
    const [rating, items] = await Promise.all([
      this.reviews.venueRating(venueId),
      this.reviews.listVenueReviews(venueId),
    ]);
    return { rating, items };
  }

  @Public()
  @Get("coaches/:coachId")
  async coachReviews(@Param("coachId") coachId: string) {
    const [rating, items] = await Promise.all([
      this.reviews.coachRating(coachId),
      this.reviews.listCoachReviews(coachId),
    ]);
    return { rating, items };
  }

  @Post("courts")
  @HttpCode(201)
  async reviewCourt(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getSessionUser(request);
    const input = reviewSchema.parse(body);
    return this.reviews.reviewCourtBooking({
      bookingId: input.bookingId,
      authorId: user.id,
      rating: input.rating,
      comment: input.comment ?? null,
    });
  }

  @Post("coaches")
  @HttpCode(201)
  async reviewCoach(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getSessionUser(request);
    const input = reviewSchema.parse(body);
    return this.reviews.reviewCoachBooking({
      bookingId: input.bookingId,
      authorId: user.id,
      rating: input.rating,
      comment: input.comment ?? null,
    });
  }
}
