import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@courtlink/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { completePastBookings } from "../src/booking-completion.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for completion integration tests");

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
  await prisma.courtBooking.deleteMany({
    where: { player: { email: { endsWith: "@cmp.integration.test" } } },
  });
  await prisma.court.deleteMany({ where: { name: { startsWith: "CMP " } } });
  await prisma.venue.deleteMany({ where: { slug: { startsWith: "cmp-" } } });
  await prisma.business.deleteMany({ where: { name: { startsWith: "CMP " } } });
  await prisma.passwordCredential.deleteMany({
    where: { user: { email: { endsWith: "@cmp.integration.test" } } },
  });
  await prisma.user.deleteMany({ where: { email: { endsWith: "@cmp.integration.test" } } });
}

async function confirmedBooking(endsAt: Date) {
  const player = await prisma.user.create({
    data: {
      email: `player-${crypto.randomUUID()}@cmp.integration.test`,
      displayName: "Cmp Player",
      credentials: { create: { passwordHash: "$argon2id$placeholder" } },
    },
  });
  const business = await prisma.business.create({ data: { name: `CMP ${crypto.randomUUID()}` } });
  const venue = await prisma.venue.create({
    data: {
      businessId: business.id,
      name: "CMP Venue",
      slug: `cmp-${crypto.randomUUID().slice(0, 8)}`,
      status: "APPROVED",
      approvedAt: new Date(),
      regionCode: "NCR",
      cityMunicipality: "Manila",
      streetAddress: "1 St",
    },
  });
  const court = await prisma.court.create({ data: { venueId: venue.id, name: "CMP Court" } });
  return prisma.courtBooking.create({
    data: {
      courtId: court.id,
      playerId: player.id,
      status: "CONFIRMED",
      startsAt: new Date(endsAt.getTime() - 3600000),
      endsAt,
      quotedAmount: "250.00",
      proofDeadline: new Date(endsAt.getTime() - 7200000),
    },
  });
}

describe("completePastBookings", () => {
  it("marks confirmed bookings completed once they end and leaves future ones", async () => {
    const past = await confirmedBooking(new Date("2026-05-02T03:00:00.000Z"));
    const future = await confirmedBooking(new Date("2030-01-01T03:00:00.000Z"));

    const result = await completePastBookings(prisma, new Date("2026-05-10T00:00:00.000Z"));
    expect(result.courts).toBeGreaterThanOrEqual(1);

    const a = await prisma.courtBooking.findUniqueOrThrow({ where: { id: past.id } });
    const b = await prisma.courtBooking.findUniqueOrThrow({ where: { id: future.id } });
    expect(a.status).toBe("COMPLETED");
    expect(b.status).toBe("CONFIRMED");
  });
});
