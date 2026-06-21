import { PrismaPg } from "@prisma/adapter-pg";
import { PlatformRole, PrismaClient } from "@courtlink/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaTenancyRepository } from "../src/tenancy/prisma-tenancy.repository.js";
import { TenancyService } from "../src/tenancy/tenancy.service.js";
import { PrismaVenueRepository } from "../src/venues/prisma-venue.repository.js";
import { VenueService } from "../src/venues/venue.service.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for venue integration tests");

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
  await prisma.venue.deleteMany({ where: { slug: { startsWith: "vtest-" } } });
  await prisma.businessMembership.deleteMany({
    where: { business: { name: { startsWith: "VTEST " } } },
  });
  await prisma.business.deleteMany({ where: { name: { startsWith: "VTEST " } } });
  await prisma.userPlatformRole.deleteMany({
    where: { user: { email: { endsWith: "@venue.integration.test" } } },
  });
  await prisma.passwordCredential.deleteMany({
    where: { user: { email: { endsWith: "@venue.integration.test" } } },
  });
  await prisma.session.deleteMany({
    where: { user: { email: { endsWith: "@venue.integration.test" } } },
  });
  await prisma.user.deleteMany({ where: { email: { endsWith: "@venue.integration.test" } } });
}

async function makeUser(role: "OWNER" | "ADMIN") {
  const suffix = crypto.randomUUID();
  const user = await prisma.user.create({
    data: {
      email: `${role.toLowerCase()}-${suffix}@venue.integration.test`,
      displayName: `${role} ${suffix}`,
      credentials: { create: { passwordHash: "$argon2id$placeholder" } },
      roles: {
        create: { role: role === "ADMIN" ? PlatformRole.SUPER_ADMIN : PlatformRole.PLAYER },
      },
    },
  });
  return user;
}

describe("Tenancy and Venue flow", () => {
  it("walks DRAFT -> PENDING_APPROVAL -> APPROVED with public visibility", async () => {
    const owner = await makeUser("OWNER");
    const tenancy = new TenancyService(new PrismaTenancyRepository(prisma));
    const venues = new VenueService(new PrismaVenueRepository(prisma));

    const business = await tenancy.createBusiness(
      { name: `VTEST ${crypto.randomUUID()}` },
      owner.id,
    );
    await tenancy.assertRole(owner.id, business.id, ["OWNER"]);

    const venue = await venues.createVenue({
      businessId: business.id,
      name: "Sunrise Pickleball",
      slug: `vtest-${crypto.randomUUID().slice(0, 8)}`,
      regionCode: "NCR",
      cityMunicipality: "Quezon City",
      streetAddress: "123 Sample Ave",
    });

    expect(venue.status).toBe("DRAFT");
    expect((await venues.listPublicVenues({})).map((v) => v.id)).not.toContain(venue.id);

    await venues.submitForReview(venue.id);
    await venues.approveVenue(venue.id, new Date("2026-06-21T00:00:00.000Z"));

    const publicList = await venues.listPublicVenues({ regionCode: "NCR" });
    expect(publicList.find((v) => v.id === venue.id)?.status).toBe("APPROVED");

    const bySlug = await venues.findVenueBySlug(venue.slug);
    expect(bySlug?.id).toBe(venue.id);
  });

  it("rejects non-members from tenancy operations", async () => {
    const owner = await makeUser("OWNER");
    const stranger = await makeUser("OWNER");
    const tenancy = new TenancyService(new PrismaTenancyRepository(prisma));

    const business = await tenancy.createBusiness(
      { name: `VTEST ${crypto.randomUUID()}` },
      owner.id,
    );

    await expect(tenancy.assertRole(stranger.id, business.id, ["OWNER"])).rejects.toMatchObject({
      code: "TENANT_FORBIDDEN",
    });
  });
});
