import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@courtlink/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SESSION_USER_KEY, type AuthenticatedRequest } from "../src/auth/session.guard.js";
import { CourtScheduleController } from "../src/courts/court-schedule.controller.js";
import { CourtScheduleService } from "../src/courts/court-schedule.service.js";
import { CourtService } from "../src/courts/court.service.js";
import { PrismaCourtRepository } from "../src/courts/prisma-court.repository.js";
import { PrismaTenancyRepository } from "../src/tenancy/prisma-tenancy.repository.js";
import { TenancyService } from "../src/tenancy/tenancy.service.js";
import { PrismaVenueRepository } from "../src/venues/prisma-venue.repository.js";
import { VenueService } from "../src/venues/venue.service.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for schedule authorization tests");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const courtRepository = new PrismaCourtRepository(prisma);
const controller = new CourtScheduleController(
  new CourtScheduleService(courtRepository),
  new CourtService(courtRepository),
  new TenancyService(new PrismaTenancyRepository(prisma)),
  new VenueService(new PrismaVenueRepository(prisma)),
);

beforeAll(async () => prisma.$connect());
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});
beforeEach(cleanup);

async function cleanup() {
  await prisma.courtClosure.deleteMany({
    where: { court: { venue: { slug: { startsWith: "schedule-auth-" } } } },
  });
  await prisma.courtOperatingHour.deleteMany({
    where: { court: { venue: { slug: { startsWith: "schedule-auth-" } } } },
  });
  await prisma.court.deleteMany({ where: { venue: { slug: { startsWith: "schedule-auth-" } } } });
  await prisma.venue.deleteMany({ where: { slug: { startsWith: "schedule-auth-" } } });
  await prisma.businessMembership.deleteMany({
    where: { business: { name: { startsWith: "SCHEDULE AUTH " } } },
  });
  await prisma.business.deleteMany({ where: { name: { startsWith: "SCHEDULE AUTH " } } });
  await prisma.user.deleteMany({
    where: { email: { endsWith: "@schedule-auth.integration.test" } },
  });
}

function request(user: { id: string; email: string; displayName: string }): AuthenticatedRequest {
  return { [SESSION_USER_KEY]: { ...user, roles: ["PLAYER"] } } as AuthenticatedRequest;
}

async function fixture() {
  const suffix = crypto.randomUUID();
  const manager = await prisma.user.create({
    data: {
      email: `${suffix}@schedule-auth.integration.test`,
      displayName: "Schedule Manager",
    },
  });
  const ownBusiness = await prisma.business.create({
    data: {
      name: `SCHEDULE AUTH OWN ${suffix}`,
      memberships: { create: { userId: manager.id, role: "MANAGER" } },
    },
  });
  const otherBusiness = await prisma.business.create({
    data: { name: `SCHEDULE AUTH OTHER ${suffix}` },
  });
  const [ownVenue, otherVenue] = await Promise.all([
    prisma.venue.create({
      data: {
        businessId: ownBusiness.id,
        name: "Own Venue",
        slug: `schedule-auth-own-${suffix}`,
        status: "APPROVED",
        regionCode: "NCR",
        cityMunicipality: "Manila",
        streetAddress: "1 Own Street",
      },
    }),
    prisma.venue.create({
      data: {
        businessId: otherBusiness.id,
        name: "Other Venue",
        slug: `schedule-auth-other-${suffix}`,
        status: "APPROVED",
        regionCode: "NCR",
        cityMunicipality: "Manila",
        streetAddress: "2 Other Street",
      },
    }),
  ]);
  const [ownCourt, otherCourt] = await Promise.all([
    prisma.court.create({ data: { venueId: ownVenue.id, name: "Own Court" } }),
    prisma.court.create({ data: { venueId: otherVenue.id, name: "Other Court" } }),
  ]);
  const otherClosure = await prisma.courtClosure.create({
    data: {
      courtId: otherCourt.id,
      startsAt: new Date("2026-07-01T00:00:00.000Z"),
      endsAt: new Date("2026-07-01T01:00:00.000Z"),
    },
  });
  return { manager, ownCourt, otherCourt, otherClosure };
}

describe("court schedule tenant authorization", () => {
  it("allows own management and denies every cross-tenant schedule operation", async () => {
    const { manager, ownCourt, otherCourt, otherClosure } = await fixture();
    const authenticated = request(manager);
    const windows = [{ dayOfWeek: 1, opensMinute: 480, closesMinute: 1_320 }];

    await expect(
      controller.replaceHours(authenticated, ownCourt.id, { windows }),
    ).resolves.toHaveLength(1);

    await expect(controller.schedule(authenticated, otherCourt.id)).rejects.toMatchObject({
      code: "TENANT_FORBIDDEN",
    });
    await expect(
      controller.replaceHours(authenticated, otherCourt.id, { windows }),
    ).rejects.toMatchObject({ code: "TENANT_FORBIDDEN" });
    await expect(
      controller.createClosure(authenticated, otherCourt.id, {
        startsAt: "2026-07-02T00:00:00.000Z",
        endsAt: "2026-07-02T01:00:00.000Z",
        reason: "Not allowed",
      }),
    ).rejects.toMatchObject({ code: "TENANT_FORBIDDEN" });
    await expect(
      controller.deleteClosure(authenticated, otherCourt.id, otherClosure.id),
    ).rejects.toMatchObject({ code: "TENANT_FORBIDDEN" });
  });
});
