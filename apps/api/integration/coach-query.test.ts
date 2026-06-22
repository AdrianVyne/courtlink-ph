import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@courtlink/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CoachBookingService } from "../src/coaches/coach-booking.service.js";
import { CoachMarketService } from "../src/coaches/coach-market.service.js";
import { CoachQueryService } from "../src/coaches/coach-query.service.js";
import { CoachService } from "../src/coaches/coach.service.js";
import { PrismaCoachBookingRepository } from "../src/coaches/prisma-coach-booking.repository.js";
import { PrismaCoachMarketRepository } from "../src/coaches/prisma-coach-market.repository.js";
import { PrismaCoachQueryRepository } from "../src/coaches/prisma-coach-query.repository.js";
import { PrismaCoachRepository } from "../src/coaches/prisma-coach.repository.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("DATABASE_URL is required for coach query integration tests");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const coaches = new CoachService(new PrismaCoachRepository(prisma));
const market = new CoachMarketService(new PrismaCoachMarketRepository(prisma));
const bookings = new CoachBookingService(new PrismaCoachBookingRepository(prisma));
const query = new CoachQueryService(new PrismaCoachQueryRepository(prisma));

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
  const where = { endsWith: "@cq.integration.test" } as const;
  await prisma.coachPaymentSubmission.deleteMany({
    where: { transactionRef: { startsWith: "CQ-" } },
  });
  await prisma.coachBooking.deleteMany({ where: { player: { email: where } } });
  await prisma.coachOffer.deleteMany({ where: { request: { player: { email: where } } } });
  await prisma.coachRequest.deleteMany({ where: { player: { email: where } } });
  await prisma.coachProfile.deleteMany({ where: { user: { email: where } } });
  await prisma.passwordCredential.deleteMany({ where: { user: { email: where } } });
  await prisma.user.deleteMany({ where: { email: where } });
}

async function makeUser(label: string) {
  return prisma.user.create({
    data: {
      email: `${label}-${crypto.randomUUID()}@cq.integration.test`,
      displayName: label,
      credentials: { create: { passwordHash: "$argon2id$placeholder" } },
    },
  });
}

describe("Coach read queries", () => {
  it("returns a coach's bookings and a player's requests with offers", async () => {
    const playerUser = await makeUser("player");
    const coachUser = await makeUser("coach");
    const coach = await coaches.upsertProfile({ userId: coachUser.id, hourlyRate: 800 });

    const startsAt = new Date(Date.now() + 7 * 86400000);
    const request = await market.createRequest({
      playerId: playerUser.id,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 3600000),
      location: "Manila",
      groupSize: 2,
      skillLevel: "beginner",
    });
    const now = new Date();
    const offer = await market.createOffer({
      requestId: request.id,
      coachId: coach.id,
      amount: 900,
      expiresAt: new Date(startsAt.getTime() - 3600000),
      now,
    });

    const mineBefore = await query.listRequestsForPlayer(playerUser.id);
    expect(mineBefore[0]?.offers.map((o) => o.id)).toContain(offer.id);
    expect(mineBefore[0]?.booking).toBeNull();

    const accepted = await market.acceptOffer({ offerId: offer.id, playerId: playerUser.id, now });
    const { submission } = await bookings.submitProof({
      bookingId: accepted.booking.id,
      playerId: playerUser.id,
      channel: "GCASH",
      transactionRef: `CQ-${crypto.randomUUID()}`,
      proofObjectKey: "proofs/coach/x.png",
    });

    const coachBookings = await query.listBookingsForCoach(coach.id);
    const target = coachBookings.find((b) => b.id === accepted.booking.id);
    expect(target?.status).toBe("PROOF_SUBMITTED");
    expect(target?.player.displayName).toBe("player");
    expect(target?.submission?.id).toBe(submission.id);

    const mineAfter = await query.listRequestsForPlayer(playerUser.id);
    expect(mineAfter[0]?.booking?.id).toBe(accepted.booking.id);
  });
});
