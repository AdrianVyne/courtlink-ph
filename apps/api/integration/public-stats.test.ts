import { PrismaClient } from "@courtlink/database";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPublicStatsRepository } from "../src/venues/prisma-public-stats.repository.js";
import { PublicStatsService } from "../src/venues/public-stats.service.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for public stats tests");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const marker = crypto.randomUUID().slice(0, 8);

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.venue.deleteMany({ where: { slug: { startsWith: `pstat-${marker}` } } });
  await prisma.business.deleteMany({ where: { name: { startsWith: `PSTAT ${marker}` } } });
  await prisma.coachProfile.deleteMany({
    where: { user: { email: { startsWith: `pstat-${marker}` } } },
  });
  await prisma.passwordCredential.deleteMany({
    where: { user: { email: { startsWith: `pstat-${marker}` } } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: `pstat-${marker}` } } });
  await prisma.$disconnect();
});

/**
 * Integration files run in parallel against one database, so these
 * assertions are >=-invariants over rows this file creates rather than
 * exact global counts.
 */
describe("Public stats", () => {
  it("counts approved venues, their cities, and active coaches", async () => {
    const business = await prisma.business.create({ data: { name: `PSTAT ${marker}` } });
    await prisma.venue.create({
      data: {
        businessId: business.id,
        name: `PSTAT Venue ${marker}`,
        slug: `pstat-${marker}-approved`,
        status: "APPROVED",
        approvedAt: new Date(),
        regionCode: "NCR",
        cityMunicipality: `PstatCity-${marker}`,
        streetAddress: "1 St",
      },
    });
    await prisma.venue.create({
      data: {
        businessId: business.id,
        name: `PSTAT Draft ${marker}`,
        slug: `pstat-${marker}-draft`,
        status: "DRAFT",
        regionCode: "NCR",
        cityMunicipality: `PstatDraftCity-${marker}`,
        streetAddress: "2 St",
      },
    });
    const coachUser = await prisma.user.create({
      data: {
        email: `pstat-${marker}@test.courtlink.ph`,
        displayName: "PSTAT Coach",
        credentials: { create: { passwordHash: "$argon2id$placeholder" } },
      },
    });
    await prisma.coachProfile.create({
      data: { userId: coachUser.id, hourlyRate: 500, active: true },
    });

    // Other integration files insert and delete venues concurrently, so the
    // stats read and the total-count read must come from one snapshot: under
    // read-committed, a cleanup landing between the two reads can shrink the
    // total below the approved count observed a moment earlier.
    const [stats, totalVenues] = await prisma.$transaction(
      async (tx) => {
        const snapshotService = new PublicStatsService(
          new PrismaPublicStatsRepository(tx as PrismaClient),
        );
        return [await snapshotService.getPublicStats(), await tx.venue.count()] as const;
      },
      { isolationLevel: "RepeatableRead" },
    );
    expect(stats.venues).toBeGreaterThanOrEqual(1);
    expect(stats.cities).toBeGreaterThanOrEqual(1);
    expect(stats.coaches).toBeGreaterThanOrEqual(1);

    // The draft venue must not be counted: approved-only filtering means the
    // approved count is strictly less than the total number of venues now in
    // the table (which includes our draft).
    expect(stats.venues).toBeLessThan(totalVenues);
  });
});
