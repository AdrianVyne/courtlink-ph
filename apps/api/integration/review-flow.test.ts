import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@courtlink/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaReviewRepository } from "../src/reviews/prisma-review.repository.js";
import { ReviewService } from "../src/reviews/review.service.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for review integration tests");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const reviews = new ReviewService(new PrismaReviewRepository(prisma));

beforeAll(async () => {
  await prisma.$connect();
});
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});
beforeEach(async () => {
  await cleanup();
});

async function cleanup() {
  await prisma.review.deleteMany({
    where: { author: { email: { endsWith: "@rev.integration.test" } } },
  });
  await prisma.courtBooking.deleteMany({
    where: { player: { email: { endsWith: "@rev.integration.test" } } },
  });
  await prisma.court.deleteMany({ where: { name: { startsWith: "REV " } } });
  await prisma.venue.deleteMany({ where: { slug: { startsWith: "rev-" } } });
  await prisma.business.deleteMany({ where: { name: { startsWith: "REV " } } });
  await prisma.passwordCredential.deleteMany({
    where: { user: { email: { endsWith: "@rev.integration.test" } } },
  });
  await prisma.user.deleteMany({ where: { email: { endsWith: "@rev.integration.test" } } });
}

async function completedBooking() {
  const player = await prisma.user.create({
    data: {
      email: `player-${crypto.randomUUID()}@rev.integration.test`,
      displayName: "Rev Player",
      credentials: { create: { passwordHash: "$argon2id$placeholder" } },
    },
  });
  const business = await prisma.business.create({ data: { name: `REV ${crypto.randomUUID()}` } });
  const venue = await prisma.venue.create({
    data: {
      businessId: business.id,
      name: "REV Venue",
      slug: `rev-${crypto.randomUUID().slice(0, 8)}`,
      status: "APPROVED",
      approvedAt: new Date(),
      regionCode: "NCR",
      cityMunicipality: "Manila",
      streetAddress: "1 St",
    },
  });
  const court = await prisma.court.create({ data: { venueId: venue.id, name: "REV Court" } });
  const booking = await prisma.courtBooking.create({
    data: {
      courtId: court.id,
      playerId: player.id,
      status: "COMPLETED",
      startsAt: new Date("2026-05-01T02:00:00.000Z"),
      endsAt: new Date("2026-05-01T03:00:00.000Z"),
      quotedAmount: "250.00",
      proofDeadline: new Date("2026-05-01T00:00:00.000Z"),
    },
  });
  return { player, venue, booking };
}

describe("Reviews", () => {
  it("lets the player review a completed booking and aggregates the rating", async () => {
    const { player, venue, booking } = await completedBooking();

    const review = await reviews.reviewCourtBooking({
      bookingId: booking.id,
      authorId: player.id,
      rating: 4,
      comment: "Good courts",
    });
    expect(review.rating).toBe(4);

    const rating = await reviews.venueRating(venue.id);
    expect(rating.count).toBe(1);
    expect(rating.average).toBe(4);

    const list = await reviews.listVenueReviews(venue.id);
    expect(list[0]?.comment).toBe("Good courts");
  });

  it("rejects a duplicate review for the same booking", async () => {
    const { player, booking } = await completedBooking();
    await reviews.reviewCourtBooking({ bookingId: booking.id, authorId: player.id, rating: 5 });
    await expect(
      reviews.reviewCourtBooking({ bookingId: booking.id, authorId: player.id, rating: 3 }),
    ).rejects.toMatchObject({ code: "REVIEW_ALREADY_EXISTS" });
  });

  it("rejects reviews for bookings that are not completed", async () => {
    const { player, booking } = await completedBooking();
    await prisma.courtBooking.update({ where: { id: booking.id }, data: { status: "CONFIRMED" } });
    await expect(
      reviews.reviewCourtBooking({ bookingId: booking.id, authorId: player.id, rating: 5 }),
    ).rejects.toMatchObject({ code: "REVIEW_NOT_COMPLETED" });
  });
});
