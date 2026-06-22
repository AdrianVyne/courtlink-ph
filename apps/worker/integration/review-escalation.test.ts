import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@courtlink/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { escalateOverdueReviews } from "../src/review-escalation.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for worker integration tests");

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
  await prisma.notification.deleteMany({
    where: { user: { email: { endsWith: "@esc.integration.test" } } },
  });
  await prisma.courtBooking.deleteMany({
    where: { player: { email: { endsWith: "@esc.integration.test" } } },
  });
  await prisma.court.deleteMany({ where: { name: { startsWith: "ESC " } } });
  await prisma.venue.deleteMany({ where: { slug: { startsWith: "esc-" } } });
  await prisma.businessMembership.deleteMany({
    where: { business: { name: { startsWith: "ESC " } } },
  });
  await prisma.business.deleteMany({ where: { name: { startsWith: "ESC " } } });
  await prisma.userPlatformRole.deleteMany({
    where: { user: { email: { endsWith: "@esc.integration.test" } } },
  });
  await prisma.passwordCredential.deleteMany({
    where: { user: { email: { endsWith: "@esc.integration.test" } } },
  });
  await prisma.user.deleteMany({ where: { email: { endsWith: "@esc.integration.test" } } });
}

async function makeUser(label: string, superAdmin = false) {
  return prisma.user.create({
    data: {
      email: `${label}-${crypto.randomUUID()}@esc.integration.test`,
      displayName: label,
      credentials: { create: { passwordHash: "$argon2id$placeholder" } },
      roles: superAdmin ? { create: { role: "SUPER_ADMIN" } } : undefined,
    },
  });
}

describe("escalateOverdueReviews", () => {
  it("notifies venue staff and super admins once for overdue court proofs", async () => {
    const owner = await makeUser("owner");
    const player = await makeUser("player");
    const admin = await makeUser("admin", true);
    const business = await prisma.business.create({
      data: {
        name: `ESC ${crypto.randomUUID()}`,
        memberships: { create: { userId: owner.id, role: "OWNER" } },
      },
    });
    const venue = await prisma.venue.create({
      data: {
        businessId: business.id,
        name: "ESC Venue",
        slug: `esc-${crypto.randomUUID().slice(0, 8)}`,
        status: "APPROVED",
        approvedAt: new Date(),
        regionCode: "NCR",
        cityMunicipality: "Manila",
        streetAddress: "1 St",
      },
    });
    const court = await prisma.court.create({ data: { venueId: venue.id, name: "ESC Court" } });
    const booking = await prisma.courtBooking.create({
      data: {
        courtId: court.id,
        playerId: player.id,
        status: "PROOF_SUBMITTED",
        startsAt: new Date("2026-09-01T02:00:00.000Z"),
        endsAt: new Date("2026-09-01T03:00:00.000Z"),
        quotedAmount: "250.00",
        proofDeadline: new Date("2026-08-31T00:00:00.000Z"),
        reviewDueAt: new Date("2026-08-31T01:00:00.000Z"),
      },
    });

    const now = new Date("2026-08-31T05:00:00.000Z");
    const first = await escalateOverdueReviews(prisma, now);
    expect(first.courts).toBeGreaterThanOrEqual(1);

    const forBooking = { path: ["bookingId"], equals: booking.id } as const;
    const ownerNotes = await prisma.notification.count({
      where: { userId: owner.id, type: "COURT_REVIEW_OVERDUE", data: forBooking },
    });
    const adminNotes = await prisma.notification.count({
      where: { userId: admin.id, type: "COURT_REVIEW_OVERDUE", data: forBooking },
    });
    expect(ownerNotes).toBe(1);
    expect(adminNotes).toBe(1);

    const refreshed = await prisma.courtBooking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(refreshed.reviewEscalatedAt).not.toBeNull();

    // Second run must not re-escalate THIS booking (idempotent). The function
    // scans all overdue proofs platform-wide, so assert idempotency against this
    // booking rather than a global count that concurrent suites can perturb.
    const escalatedAt = refreshed.reviewEscalatedAt;
    await escalateOverdueReviews(prisma, now);
    const reRun = await prisma.courtBooking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(reRun.reviewEscalatedAt).toEqual(escalatedAt);
    const ownerNotesAfter = await prisma.notification.count({
      where: { userId: owner.id, type: "COURT_REVIEW_OVERDUE", data: forBooking },
    });
    expect(ownerNotesAfter).toBe(1);
  });

  it("does not escalate bookings still within the review window", async () => {
    const owner = await makeUser("owner");
    const player = await makeUser("player");
    const business = await prisma.business.create({
      data: {
        name: `ESC ${crypto.randomUUID()}`,
        memberships: { create: { userId: owner.id, role: "OWNER" } },
      },
    });
    const venue = await prisma.venue.create({
      data: {
        businessId: business.id,
        name: "ESC Venue",
        slug: `esc-${crypto.randomUUID().slice(0, 8)}`,
        status: "APPROVED",
        approvedAt: new Date(),
        regionCode: "NCR",
        cityMunicipality: "Manila",
        streetAddress: "1 St",
      },
    });
    const court = await prisma.court.create({ data: { venueId: venue.id, name: "ESC Court" } });
    const booking = await prisma.courtBooking.create({
      data: {
        courtId: court.id,
        playerId: player.id,
        status: "PROOF_SUBMITTED",
        startsAt: new Date("2026-09-01T02:00:00.000Z"),
        endsAt: new Date("2026-09-01T03:00:00.000Z"),
        quotedAmount: "250.00",
        proofDeadline: new Date("2026-08-31T00:00:00.000Z"),
        reviewDueAt: new Date("2026-08-31T10:00:00.000Z"),
      },
    });

    // This booking's review window has not lapsed at this instant, so it must not
    // be escalated. Assert against this booking, not a global count concurrent
    // suites can perturb.
    await escalateOverdueReviews(prisma, new Date("2026-08-31T05:00:00.000Z"));
    const refreshed = await prisma.courtBooking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(refreshed.reviewEscalatedAt).toBeNull();
  });
});
