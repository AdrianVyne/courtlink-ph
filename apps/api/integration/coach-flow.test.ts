import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@courtlink/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CoachBookingService } from "../src/coaches/coach-booking.service.js";
import { CoachMarketService } from "../src/coaches/coach-market.service.js";
import { CoachService } from "../src/coaches/coach.service.js";
import { PrismaCoachBookingRepository } from "../src/coaches/prisma-coach-booking.repository.js";
import { PrismaCoachMarketRepository } from "../src/coaches/prisma-coach-market.repository.js";
import { PrismaCoachRepository } from "../src/coaches/prisma-coach.repository.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for coach integration tests");

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
  await prisma.coachPaymentSubmission.deleteMany({
    where: { transactionRef: { startsWith: "CTEST-" } },
  });
  await prisma.coachBooking.deleteMany({
    where: { player: { email: { endsWith: "@coach.integration.test" } } },
  });
  await prisma.coachOffer.deleteMany({
    where: { request: { player: { email: { endsWith: "@coach.integration.test" } } } },
  });
  await prisma.coachRequest.deleteMany({
    where: { player: { email: { endsWith: "@coach.integration.test" } } },
  });
  await prisma.coachAvailability.deleteMany({
    where: { coach: { user: { email: { endsWith: "@coach.integration.test" } } } },
  });
  await prisma.coachProfile.deleteMany({
    where: { user: { email: { endsWith: "@coach.integration.test" } } },
  });
  await prisma.passwordCredential.deleteMany({
    where: { user: { email: { endsWith: "@coach.integration.test" } } },
  });
  await prisma.user.deleteMany({ where: { email: { endsWith: "@coach.integration.test" } } });
}

async function makeUser(label: string) {
  return prisma.user.create({
    data: {
      email: `${label}-${crypto.randomUUID()}@coach.integration.test`,
      displayName: label,
      credentials: { create: { passwordHash: "$argon2id$placeholder" } },
    },
  });
}

describe("Coach marketplace flow", () => {
  it("accepts one offer atomically, rejects competitors, and confirms via proof", async () => {
    const player = await makeUser("player");
    const coachUserA = await makeUser("coachA");
    const coachUserB = await makeUser("coachB");

    const coaches = new CoachService(new PrismaCoachRepository(prisma));
    const market = new CoachMarketService(new PrismaCoachMarketRepository(prisma));
    const bookings = new CoachBookingService(new PrismaCoachBookingRepository(prisma));

    const coachA = await coaches.upsertProfile({ userId: coachUserA.id, hourlyRate: 800 });
    const coachB = await coaches.upsertProfile({ userId: coachUserB.id, hourlyRate: 900 });

    // One consistent clock for the whole flow, with relative dates so the
    // test never goes stale (fixed 2026 dates previously let the hold expire
    // for real once the calendar passed them).
    const now = new Date();
    const sessionStart = new Date(now.getTime() + 7 * 86400000);
    const request = await market.createRequest({
      playerId: player.id,
      startsAt: sessionStart,
      endsAt: new Date(sessionStart.getTime() + 3600000),
      location: "Manila Pickleball Center",
      groupSize: 2,
      skillLevel: "beginner",
    });

    const expiresAt = new Date(sessionStart.getTime() - 2 * 3600000);
    const winner = await market.createOffer({
      requestId: request.id,
      coachId: coachA.id,
      amount: 850,
      expiresAt,
      now,
    });
    await market.createOffer({
      requestId: request.id,
      coachId: coachB.id,
      amount: 950,
      expiresAt,
      now,
    });

    const accepted = await market.acceptOffer({ offerId: winner.id, playerId: player.id, now });
    expect(accepted.booking.status).toBe("HELD");
    expect(accepted.booking.amount).toBe(850);
    expect(accepted.request.status).toBe("MATCHED");

    const offers = await market.listOffersForRequest(request.id);
    const loserStatus = offers.find((o) => o.coachId === coachB.id)?.status;
    expect(loserStatus).toBe("REJECTED");

    const { submission } = await bookings.submitProof({
      bookingId: accepted.booking.id,
      playerId: player.id,
      channel: "GCASH",
      transactionRef: `CTEST-${crypto.randomUUID()}`,
      proofObjectKey: "proofs/coach.jpg",
      now,
    });
    const confirmed = await bookings.approveProof({
      submissionId: submission.id,
      bookingId: accepted.booking.id,
    });
    expect(confirmed.status).toBe("CONFIRMED");
  });

  it("prevents accepting a second offer once the request is matched", async () => {
    const player = await makeUser("player");
    const coachUserA = await makeUser("coachA");
    const coachUserB = await makeUser("coachB");

    const coaches = new CoachService(new PrismaCoachRepository(prisma));
    const market = new CoachMarketService(new PrismaCoachMarketRepository(prisma));

    const coachA = await coaches.upsertProfile({ userId: coachUserA.id, hourlyRate: 800 });
    const coachB = await coaches.upsertProfile({ userId: coachUserB.id, hourlyRate: 900 });

    const request = await market.createRequest({
      playerId: player.id,
      startsAt: new Date("2026-07-01T02:00:00.000Z"),
      endsAt: new Date("2026-07-01T03:00:00.000Z"),
      location: "Manila Pickleball Center",
      groupSize: 2,
      skillLevel: "beginner",
    });
    const now = new Date("2026-06-30T12:00:00.000Z");
    const expiresAt = new Date("2026-07-01T00:00:00.000Z");
    const offerA = await market.createOffer({
      requestId: request.id,
      coachId: coachA.id,
      amount: 850,
      expiresAt,
      now,
    });
    const offerB = await market.createOffer({
      requestId: request.id,
      coachId: coachB.id,
      amount: 950,
      expiresAt,
      now,
    });

    await market.acceptOffer({ offerId: offerA.id, playerId: player.id, now });
    await expect(
      market.acceptOffer({ offerId: offerB.id, playerId: player.id, now }),
    ).rejects.toMatchObject({ code: "REQUEST_NOT_OPEN" });
  });
});
