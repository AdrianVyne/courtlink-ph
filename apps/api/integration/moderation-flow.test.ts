import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@courtlink/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FavoriteService } from "../src/favorites/favorite.service.js";
import { PrismaFavoriteRepository } from "../src/favorites/prisma-favorite.repository.js";
import { ModerationService } from "../src/moderation/moderation.service.js";
import { PrismaModerationRepository } from "../src/moderation/prisma-moderation.repository.js";
import { PrismaVenueRepository } from "../src/venues/prisma-venue.repository.js";
import { VenueService } from "../src/venues/venue.service.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for moderation integration tests");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const moderation = new ModerationService(new PrismaModerationRepository(prisma));
const favorites = new FavoriteService(new PrismaFavoriteRepository(prisma));
const venues = new VenueService(new PrismaVenueRepository(prisma));

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
  await prisma.auditEvent.deleteMany({
    where: { actor: { email: { endsWith: "@mod.integration.test" } } },
  });
  await prisma.moderationCase.deleteMany({
    where: { reporter: { email: { endsWith: "@mod.integration.test" } } },
  });
  await prisma.favoriteVenue.deleteMany({
    where: { user: { email: { endsWith: "@mod.integration.test" } } },
  });
  await prisma.venue.deleteMany({ where: { slug: { startsWith: "mod-" } } });
  await prisma.business.deleteMany({ where: { name: { startsWith: "MOD " } } });
  await prisma.session.deleteMany({
    where: { user: { email: { endsWith: "@mod.integration.test" } } },
  });
  await prisma.passwordCredential.deleteMany({
    where: { user: { email: { endsWith: "@mod.integration.test" } } },
  });
  await prisma.user.deleteMany({ where: { email: { endsWith: "@mod.integration.test" } } });
}

async function makeUser(label: string) {
  return prisma.user.create({
    data: {
      email: `${label}-${crypto.randomUUID()}@mod.integration.test`,
      displayName: label,
      credentials: { create: { passwordHash: "$argon2id$placeholder" } },
    },
  });
}

async function approvedVenue() {
  const business = await prisma.business.create({ data: { name: `MOD ${crypto.randomUUID()}` } });
  return prisma.venue.create({
    data: {
      businessId: business.id,
      name: "MOD Venue",
      slug: `mod-${crypto.randomUUID().slice(0, 8)}`,
      status: "APPROVED",
      approvedAt: new Date(),
      regionCode: "NCR",
      cityMunicipality: "Manila",
      streetAddress: "1 St",
    },
  });
}

describe("Moderation", () => {
  it("reports a venue, suspends it, and removes it from public listings with an audit trail", async () => {
    const reporter = await makeUser("reporter");
    const admin = await makeUser("admin");
    const venue = await approvedVenue();

    const before = await venues.listPublicVenues({ regionCode: "NCR" });
    expect(before.some((v) => v.id === venue.id)).toBe(true);

    const moderationCase = await moderation.report({
      reporterId: reporter.id,
      subjectType: "VENUE",
      subjectId: venue.id,
      reason: "Impersonating a real venue",
    });
    expect(moderationCase.status).toBe("OPEN");

    const open = await moderation.listOpenCases();
    expect(open.some((c) => c.id === moderationCase.id)).toBe(true);

    await moderation.setSuspension({
      actorId: admin.id,
      subjectType: "VENUE",
      subjectId: venue.id,
      suspended: true,
    });

    const after = await venues.listPublicVenues({ regionCode: "NCR" });
    expect(after.some((v) => v.id === venue.id)).toBe(false);

    const audit = await prisma.auditEvent.findFirst({
      where: { subjectId: venue.id, action: "SUBJECT_SUSPENDED" },
    });
    expect(audit?.actorId).toBe(admin.id);

    await moderation.resolveCase({
      caseId: moderationCase.id,
      actorId: admin.id,
      status: "RESOLVED",
      resolution: "Suspended pending verification",
    });
    const stillOpen = await moderation.listOpenCases();
    expect(stillOpen.some((c) => c.id === moderationCase.id)).toBe(false);
  });

  it("suspending a user deletes their sessions", async () => {
    const user = await makeUser("target");
    const admin = await makeUser("admin");
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: `mod-${crypto.randomUUID()}`,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);

    await moderation.setSuspension({
      actorId: admin.id,
      subjectType: "USER",
      subjectId: user.id,
      suspended: true,
    });

    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    const refreshed = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(refreshed.status).toBe("SUSPENDED");
  });
});

describe("Favorites", () => {
  it("adds, lists, and removes a favorite venue idempotently", async () => {
    const user = await makeUser("fan");
    const venue = await approvedVenue();

    await favorites.add(user.id, venue.id);
    await favorites.add(user.id, venue.id);
    expect(await favorites.isFavorite(user.id, venue.id)).toBe(true);

    const list = await favorites.list(user.id);
    expect(list.map((v) => v.id)).toContain(venue.id);

    await favorites.remove(user.id, venue.id);
    expect(await favorites.isFavorite(user.id, venue.id)).toBe(false);
  });

  it("rejects favoriting a venue that does not exist", async () => {
    const user = await makeUser("fan");
    await expect(favorites.add(user.id, crypto.randomUUID())).rejects.toMatchObject({
      code: "VENUE_NOT_FOUND",
    });
  });
});
