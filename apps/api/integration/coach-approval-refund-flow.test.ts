import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@courtlink/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CoachBookingService } from "../src/coaches/coach-booking.service.js";
import { CoachMarketService } from "../src/coaches/coach-market.service.js";
import { CoachRefundService } from "../src/coaches/coach-refund.service.js";
import { CoachService } from "../src/coaches/coach.service.js";
import { PrismaCoachBookingRepository } from "../src/coaches/prisma-coach-booking.repository.js";
import { PrismaCoachMarketRepository } from "../src/coaches/prisma-coach-market.repository.js";
import { PrismaCoachRefundRepository } from "../src/coaches/prisma-coach-refund.repository.js";
import { PrismaCoachRepository } from "../src/coaches/prisma-coach.repository.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for coach refund tests");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const coaches = new CoachService(new PrismaCoachRepository(prisma));
const market = new CoachMarketService(new PrismaCoachMarketRepository(prisma));
const bookings = new CoachBookingService(new PrismaCoachBookingRepository(prisma));
const refunds = new CoachRefundService(new PrismaCoachRefundRepository(prisma));

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
  const playerFilter = { email: { endsWith: "@coachref.integration.test" } };
  await prisma.coachRefund.deleteMany({
    where: { booking: { player: playerFilter } },
  });
  await prisma.coachPaymentSubmission.deleteMany({
    where: { transactionRef: { startsWith: "CRTEST-" } },
  });
  await prisma.coachBooking.deleteMany({ where: { player: playerFilter } });
  await prisma.coachOffer.deleteMany({ where: { request: { player: playerFilter } } });
  await prisma.coachRequest.deleteMany({ where: { player: playerFilter } });
  await prisma.coachProfile.deleteMany({ where: { user: playerFilter } });
  await prisma.passwordCredential.deleteMany({ where: { user: playerFilter } });
  await prisma.user.deleteMany({ where: playerFilter });
}

async function makeUser(label: string) {
  return prisma.user.create({
    data: {
      email: `${label}-${crypto.randomUUID()}@coachref.integration.test`,
      displayName: label,
      credentials: { create: { passwordHash: "$argon2id$placeholder" } },
    },
  });
}

async function confirmedBooking(sessionStart: Date) {
  const player = await makeUser("player");
  const coachUser = await makeUser("coach");
  const coach = await coaches.upsertProfile({ userId: coachUser.id, hourlyRate: 800 });
  const request = await market.createRequest({
    playerId: player.id,
    targetCoachId: coach.id,
    startsAt: sessionStart,
    endsAt: new Date(sessionStart.getTime() + 60 * 60 * 1000),
    location: "Manila Pickleball Center",
    groupSize: 1,
    skillLevel: "beginner",
  });
  return { player, coachUser, coach, request, sessionStart };
}

describe("Directed coach approval flow", () => {
  it("requires coach approval before an offer can be made", async () => {
    const sessionStart = new Date("2026-08-01T02:00:00.000Z");
    const { coach, request } = await confirmedBooking(sessionStart);
    const dbRequest = await prisma.coachRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(dbRequest.status).toBe("PENDING_COACH");

    const now = new Date("2026-07-20T00:00:00.000Z");
    await expect(
      market.createOffer({
        requestId: request.id,
        coachId: coach.id,
        amount: 800,
        expiresAt: new Date("2026-08-01T00:00:00.000Z"),
        now,
      }),
    ).rejects.toMatchObject({ code: "REQUEST_NOT_OPEN" });

    await market.approveDirectedRequest({ requestId: request.id, coachId: coach.id });
    const offer = await market.createOffer({
      requestId: request.id,
      coachId: coach.id,
      amount: 800,
      expiresAt: new Date("2026-08-01T00:00:00.000Z"),
      now,
    });
    expect(offer.status).toBe("ACTIVE");
  });

  it("declines a directed request so it cannot be approved later", async () => {
    const { coach, request } = await confirmedBooking(new Date("2026-08-02T02:00:00.000Z"));
    await market.declineDirectedRequest({ requestId: request.id, coachId: coach.id });
    const dbRequest = await prisma.coachRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(dbRequest.status).toBe("DECLINED");
    await expect(
      market.approveDirectedRequest({ requestId: request.id, coachId: coach.id }),
    ).rejects.toMatchObject({ code: "REQUEST_NOT_PENDING" });
  });
});

describe("Coach refund and cancellation lifecycle", () => {
  async function bookConfirmed(sessionStart: Date) {
    const { player, coach, request } = await confirmedBooking(sessionStart);
    const now = new Date(sessionStart.getTime() - 21 * 24 * 60 * 60 * 1000);
    await market.approveDirectedRequest({ requestId: request.id, coachId: coach.id });
    const offer = await market.createOffer({
      requestId: request.id,
      coachId: coach.id,
      amount: 800,
      expiresAt: new Date(sessionStart.getTime() - 60 * 60 * 1000),
      now,
    });
    const accepted = await market.acceptOffer({ offerId: offer.id, playerId: player.id, now });
    const { submission } = await bookings.submitProof({
      bookingId: accepted.booking.id,
      playerId: player.id,
      channel: "GCASH",
      transactionRef: `CRTEST-${crypto.randomUUID()}`,
      proofObjectKey: "proofs/coach.jpg",
      now,
    });
    await bookings.approveProof({ submissionId: submission.id, bookingId: accepted.booking.id });
    return { player, coach, bookingId: accepted.booking.id, now };
  }

  it("lets a player request a refund, then the coach approves and completes it", async () => {
    const sessionStart = new Date("2026-09-01T02:00:00.000Z");
    const { player, bookingId } = await bookConfirmed(sessionStart);
    const requestedAt = new Date("2026-08-01T00:00:00.000Z");

    const refund = await refunds.requestRefund({
      bookingId,
      playerId: player.id,
      reason: "Schedule clash",
      now: requestedAt,
    });
    expect(refund.status).toBe("REQUESTED");
    let booking = await prisma.coachBooking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(booking.status).toBe("REFUND_REQUESTED");

    await refunds.decideRefund({ refundId: refund.id, decision: "APPROVED" });
    booking = await prisma.coachBooking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(booking.status).toBe("CANCELLED");

    const completed = await refunds.completeRefund({
      refundId: refund.id,
      channel: "GCASH",
      transactionRef: "CRREF-1",
    });
    expect(completed.status).toBe("COMPLETED");
    const dbRefund = await prisma.coachRefund.findUniqueOrThrow({ where: { id: refund.id } });
    expect(dbRefund.completedAt).not.toBeNull();
    expect(dbRefund.decidedAt).not.toBeNull();
  });

  it("rejects a player refund inside the seven-day window", async () => {
    const sessionStart = new Date("2026-09-05T02:00:00.000Z");
    const { player, bookingId } = await bookConfirmed(sessionStart);
    await expect(
      refunds.requestRefund({
        bookingId,
        playerId: player.id,
        reason: "Too late",
        now: new Date("2026-09-04T00:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "REFUND_NOT_ELIGIBLE" });
  });

  it("lets a coach cancel a confirmed booking with an always-eligible refund", async () => {
    const sessionStart = new Date("2026-09-10T02:00:00.000Z");
    const { bookingId } = await bookConfirmed(sessionStart);
    const refund = await refunds.cancelByCoach({ bookingId, reason: "Coach injured" });
    expect(refund.status).toBe("APPROVED");
    const booking = await prisma.coachBooking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(booking.status).toBe("CANCELLED");
  });
});
