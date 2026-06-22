import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@courtlink/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { BookingService } from "../src/courts/booking.service.js";
import { PrismaBookingRepository } from "../src/courts/prisma-booking.repository.js";
import { PrismaCourtRepository } from "../src/courts/prisma-court.repository.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for booking integration tests");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

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
  await prisma.courtPaymentSubmission.deleteMany({
    where: { transactionRef: { startsWith: "BTEST-" } },
  });
  await prisma.courtBooking.deleteMany({
    where: { player: { email: { endsWith: "@booking.integration.test" } } },
  });
  await prisma.courtPricingRule.deleteMany({
    where: { court: { name: { startsWith: "BTEST " } } },
  });
  await prisma.court.deleteMany({ where: { name: { startsWith: "BTEST " } } });
  await prisma.venue.deleteMany({ where: { slug: { startsWith: "btest-" } } });
  await prisma.businessMembership.deleteMany({
    where: { business: { name: { startsWith: "BTEST " } } },
  });
  await prisma.business.deleteMany({ where: { name: { startsWith: "BTEST " } } });
  await prisma.userPlatformRole.deleteMany({
    where: { user: { email: { endsWith: "@booking.integration.test" } } },
  });
  await prisma.passwordCredential.deleteMany({
    where: { user: { email: { endsWith: "@booking.integration.test" } } },
  });
  await prisma.session.deleteMany({
    where: { user: { email: { endsWith: "@booking.integration.test" } } },
  });
  await prisma.user.deleteMany({ where: { email: { endsWith: "@booking.integration.test" } } });
}

async function setup() {
  const ownerEmail = `owner-${crypto.randomUUID()}@booking.integration.test`;
  const playerEmail = `player-${crypto.randomUUID()}@booking.integration.test`;
  const [owner, player, business] = await prisma.$transaction(async (tx) => {
    const owner = await tx.user.create({
      data: {
        email: ownerEmail,
        displayName: "Owner",
        credentials: { create: { passwordHash: "$argon2id$placeholder" } },
      },
    });
    const player = await tx.user.create({
      data: {
        email: playerEmail,
        displayName: "Player",
        credentials: { create: { passwordHash: "$argon2id$placeholder" } },
      },
    });
    const business = await tx.business.create({
      data: {
        name: `BTEST ${crypto.randomUUID()}`,
        memberships: { create: { userId: owner.id, role: "OWNER" } },
      },
    });
    return [owner, player, business] as const;
  });
  const venue = await prisma.venue.create({
    data: {
      businessId: business.id,
      name: "BTEST Venue",
      slug: `btest-${crypto.randomUUID().slice(0, 8)}`,
      regionCode: "NCR",
      cityMunicipality: "Manila",
      streetAddress: "1 Sample St",
      status: "APPROVED",
      approvedAt: new Date(),
    },
  });
  const court = await prisma.court.create({
    data: {
      venueId: venue.id,
      name: `BTEST Court`,
      slotIncrementMin: 30,
      minimumDurationMin: 60,
      maximumDurationMin: 240,
      operatingHours: {
        create: Array.from({ length: 7 }, (_, dayOfWeek) => ({
          dayOfWeek,
          opensMinute: 0,
          closesMinute: 1_440,
        })),
      },
      pricingRules: {
        create: {
          startsMinute: 0,
          endsMinute: 24 * 60,
          pricePerHour: "250.00",
          priority: 0,
        },
      },
    },
  });
  return { owner, player, business, venue, court };
}

describe("Court booking lifecycle", () => {
  it("creates a hold, accepts proof, and confirms via approval", async () => {
    const { player, court } = await setup();
    const service = new BookingService(
      new PrismaBookingRepository(prisma),
      new PrismaCourtRepository(prisma),
    );

    const booking = await service.createHold({
      courtId: court.id,
      playerId: player.id,
      startsAt: new Date("2026-06-22T01:00:00.000Z"),
      endsAt: new Date("2026-06-22T02:00:00.000Z"),
    });

    expect(booking.status).toBe("HELD");
    expect(booking.quotedAmount).toBe(250);

    const { submission } = await service.submitProof({
      bookingId: booking.id,
      playerId: player.id,
      channel: "GCASH",
      transactionRef: `BTEST-${crypto.randomUUID()}`,
      proofObjectKey: "proofs/test.jpg",
    });

    const confirmed = await service.approveProof({
      bookingId: booking.id,
      submissionId: submission.id,
      reviewedById: player.id,
    });
    expect(confirmed.status).toBe("CONFIRMED");
  });

  it("rejects overlapping confirmed bookings via the GiST exclusion constraint", async () => {
    const { player, court } = await setup();
    const service = new BookingService(
      new PrismaBookingRepository(prisma),
      new PrismaCourtRepository(prisma),
    );

    const first = await service.createHold({
      courtId: court.id,
      playerId: player.id,
      startsAt: new Date("2026-06-22T03:00:00.000Z"),
      endsAt: new Date("2026-06-22T04:00:00.000Z"),
    });
    const { submission } = await service.submitProof({
      bookingId: first.id,
      playerId: player.id,
      channel: "GCASH",
      transactionRef: `BTEST-${crypto.randomUUID()}`,
      proofObjectKey: "proofs/ok.jpg",
    });
    await service.approveProof({
      bookingId: first.id,
      submissionId: submission.id,
      reviewedById: player.id,
    });

    await expect(
      service.createHold({
        courtId: court.id,
        playerId: player.id,
        startsAt: new Date("2026-06-22T03:30:00.000Z"),
        endsAt: new Date("2026-06-22T04:30:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "COURT_BOOKING_CONFLICT" });
  });

  it("expires stale holds via the worker query", async () => {
    const { player, court } = await setup();
    const repo = new PrismaBookingRepository(prisma);
    const service = new BookingService(repo, new PrismaCourtRepository(prisma));

    const booking = await service.createHold({
      courtId: court.id,
      playerId: player.id,
      startsAt: new Date("2026-06-22T05:00:00.000Z"),
      endsAt: new Date("2026-06-22T06:00:00.000Z"),
      now: new Date("2026-06-22T04:50:00.000Z"),
    });
    expect(booking.status).toBe("HELD");

    const expiredCount = await repo.expireStaleHolds(new Date("2026-06-22T05:00:00.000Z"));
    expect(expiredCount).toBeGreaterThanOrEqual(1);

    const refreshed = await repo.getBooking(booking.id);
    expect(refreshed?.status).toBe("EXPIRED");
  });
});
