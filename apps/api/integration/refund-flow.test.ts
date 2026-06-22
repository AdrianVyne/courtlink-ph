import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@courtlink/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { BookingService } from "../src/courts/booking.service.js";
import { PrismaBookingRepository } from "../src/courts/prisma-booking.repository.js";
import { PrismaCourtRepository } from "../src/courts/prisma-court.repository.js";
import { PrismaRefundRepository } from "../src/courts/prisma-refund.repository.js";
import { RefundService } from "../src/courts/refund.service.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for refund integration tests");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const bookings = new BookingService(
  new PrismaBookingRepository(prisma),
  new PrismaCourtRepository(prisma),
);
const refunds = new RefundService(new PrismaRefundRepository(prisma));

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
  await prisma.courtRefund.deleteMany({
    where: { booking: { player: { email: { endsWith: "@refund.integration.test" } } } },
  });
  await prisma.courtPaymentSubmission.deleteMany({
    where: { transactionRef: { startsWith: "RFT-" } },
  });
  await prisma.courtBooking.deleteMany({
    where: { player: { email: { endsWith: "@refund.integration.test" } } },
  });
  await prisma.courtPricingRule.deleteMany({ where: { court: { name: { startsWith: "RFT " } } } });
  await prisma.court.deleteMany({ where: { name: { startsWith: "RFT " } } });
  await prisma.venue.deleteMany({ where: { slug: { startsWith: "rft-" } } });
  await prisma.businessMembership.deleteMany({
    where: { business: { name: { startsWith: "RFT " } } },
  });
  await prisma.business.deleteMany({ where: { name: { startsWith: "RFT " } } });
  await prisma.passwordCredential.deleteMany({
    where: { user: { email: { endsWith: "@refund.integration.test" } } },
  });
  await prisma.user.deleteMany({ where: { email: { endsWith: "@refund.integration.test" } } });
}

async function confirmedBooking(startsAt: Date) {
  const player = await prisma.user.create({
    data: {
      email: `player-${crypto.randomUUID()}@refund.integration.test`,
      displayName: "Refund Player",
      credentials: { create: { passwordHash: "$argon2id$placeholder" } },
    },
  });
  const business = await prisma.business.create({ data: { name: `RFT ${crypto.randomUUID()}` } });
  const venue = await prisma.venue.create({
    data: {
      businessId: business.id,
      name: "RFT Venue",
      slug: `rft-${crypto.randomUUID().slice(0, 8)}`,
      status: "APPROVED",
      approvedAt: new Date(),
      regionCode: "NCR",
      cityMunicipality: "Manila",
      streetAddress: "1 Sample St",
    },
  });
  const court = await prisma.court.create({
    data: {
      venueId: venue.id,
      name: "RFT Court",
      operatingHours: {
        create: Array.from({ length: 7 }, (_, dayOfWeek) => ({
          dayOfWeek,
          opensMinute: 0,
          closesMinute: 1_440,
        })),
      },
      pricingRules: {
        create: { startsMinute: 0, endsMinute: 24 * 60, pricePerHour: "250.00", priority: 0 },
      },
    },
  });
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
  const hold = await bookings.createHold({
    courtId: court.id,
    playerId: player.id,
    startsAt,
    endsAt,
  });
  const { submission } = await bookings.submitProof({
    bookingId: hold.id,
    playerId: player.id,
    channel: "GCASH",
    transactionRef: `RFT-${crypto.randomUUID()}`,
    proofObjectKey: "proofs/rft.jpg",
  });
  await bookings.approveProof({
    bookingId: hold.id,
    submissionId: submission.id,
    reviewedById: player.id,
  });
  return { player, booking: hold };
}

describe("Court refund lifecycle", () => {
  it("requests, approves, and completes a refund at least seven days out", async () => {
    const startsAt = new Date("2026-08-01T02:00:00.000Z");
    const { player, booking } = await confirmedBooking(startsAt);

    const refund = await refunds.requestRefund({
      bookingId: booking.id,
      playerId: player.id,
      reason: "Cannot make it",
      now: new Date("2026-07-20T00:00:00.000Z"),
    });
    expect(refund.status).toBe("REQUESTED");

    const approved = await refunds.decideRefund({ refundId: refund.id, decision: "APPROVED" });
    expect(approved.status).toBe("APPROVED");

    const completed = await refunds.completeRefund({
      refundId: refund.id,
      channel: "GCASH",
      transactionRef: "RFOUT-1",
    });
    expect(completed.status).toBe("COMPLETED");

    const persisted = await prisma.courtBooking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(persisted.status).toBe("CANCELLED");
  });

  it("rejects refund requests inside the seven-day window", async () => {
    const startsAt = new Date("2026-08-01T02:00:00.000Z");
    const { player, booking } = await confirmedBooking(startsAt);

    await expect(
      refunds.requestRefund({
        bookingId: booking.id,
        playerId: player.id,
        reason: "late",
        now: new Date("2026-07-28T00:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "REFUND_NOT_ELIGIBLE" });
  });

  it("lets a venue cancel a confirmed booking regardless of the window", async () => {
    const startsAt = new Date("2026-08-01T02:00:00.000Z");
    const { booking } = await confirmedBooking(startsAt);

    const refund = await refunds.cancelByVenue({
      bookingId: booking.id,
      reason: "Court maintenance",
    });
    expect(refund.status).toBe("APPROVED");
    const persisted = await prisma.courtBooking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(persisted.status).toBe("CANCELLED");
    expect(persisted.cancellationCause).toBe("venue");
  });
});
