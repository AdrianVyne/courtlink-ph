import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@courtlink/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DiscoveryService } from "../src/venues/discovery.service.js";
import { PrismaDiscoveryRepository } from "../src/venues/prisma-discovery.repository.js";
import { AmenityService } from "../src/amenities/amenity.service.js";
import { PrismaAmenityRepository } from "../src/amenities/prisma-amenity.repository.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for discovery tests");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const discovery = new DiscoveryService(new PrismaDiscoveryRepository(prisma));
const amenities = new AmenityService(new PrismaAmenityRepository(prisma));

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
  await prisma.courtBooking.deleteMany({ where: { court: { name: { startsWith: "DISC " } } } });
  await prisma.courtPricingRule.deleteMany({ where: { court: { name: { startsWith: "DISC " } } } });
  await prisma.courtOperatingHour.deleteMany({
    where: { court: { name: { startsWith: "DISC " } } },
  });
  await prisma.court.deleteMany({ where: { name: { startsWith: "DISC " } } });
  await prisma.venue.deleteMany({ where: { slug: { startsWith: "disc-" } } });
  await prisma.business.deleteMany({ where: { name: { startsWith: "DISC " } } });
}

async function makeVenue(opts: {
  slug: string;
  city: string;
  region?: string;
  pricePerHour: number;
  amenityKeys?: string[];
}) {
  const business = await prisma.business.create({ data: { name: `DISC ${crypto.randomUUID()}` } });
  const venue = await prisma.venue.create({
    data: {
      businessId: business.id,
      name: `DISC Venue ${opts.slug}`,
      slug: opts.slug,
      status: "APPROVED",
      approvedAt: new Date(),
      regionCode: opts.region ?? "NCR",
      cityMunicipality: opts.city,
      streetAddress: "1 St",
    },
  });
  await prisma.court.create({
    data: {
      venueId: venue.id,
      name: `DISC Court ${opts.slug}`,
      slotIncrementMin: 60,
      minimumDurationMin: 60,
      maximumDurationMin: 240,
      operatingHours: {
        create: Array.from({ length: 7 }, (_, dayOfWeek) => ({
          dayOfWeek,
          opensMinute: 0,
          closesMinute: 1440,
        })),
      },
      pricingRules: {
        create: {
          startsMinute: 0,
          endsMinute: 1440,
          pricePerHour: opts.pricePerHour.toFixed(2),
          priority: 0,
        },
      },
    },
  });
  if (opts.amenityKeys?.length) {
    await amenities.setVenueAmenities(venue.id, opts.amenityKeys);
  }
  return venue;
}

describe("Discovery filters", () => {
  it("filters by city, amenities, and price range", async () => {
    await makeVenue({
      slug: "disc-a",
      city: "Cebu City",
      pricePerHour: 250,
      amenityKeys: ["PARKING", "SHOWERS"],
    });
    await makeVenue({
      slug: "disc-b",
      city: "Cebu City",
      pricePerHour: 900,
      amenityKeys: ["PARKING"],
    });
    await makeVenue({
      slug: "disc-c",
      city: "Davao City",
      pricePerHour: 250,
      amenityKeys: ["PARKING"],
    });

    const byCity = await discovery.search({ cityMunicipality: "Cebu City" });
    expect(byCity.map((r) => r.venue.slug).sort()).toEqual(["disc-a", "disc-b"]);

    const byAmenity = await discovery.search({
      cityMunicipality: "Cebu City",
      amenities: ["SHOWERS"],
    });
    expect(byAmenity.map((r) => r.venue.slug)).toEqual(["disc-a"]);

    const byPrice = await discovery.search({ cityMunicipality: "Cebu City", maxPrice: 400 });
    expect(byPrice.map((r) => r.venue.slug)).toEqual(["disc-a"]);
    expect(byPrice[0]?.fromPrice).toBe(250);
  });

  it("filters by availability on a Manila date and excludes booked courts", async () => {
    const open = await makeVenue({ slug: "disc-open", city: "Quezon City", pricePerHour: 300 });
    const booked = await makeVenue({ slug: "disc-booked", city: "Quezon City", pricePerHour: 300 });
    const bookedCourt = await prisma.court.findFirstOrThrow({ where: { venueId: booked.id } });
    const player = await prisma.user.create({
      data: {
        email: `disc-${crypto.randomUUID()}@disc.test`,
        displayName: "P",
        credentials: { create: { passwordHash: "$argon2id$placeholder" } },
      },
    });
    // Block the entire Manila day 2026-06-22 for the booked court.
    await prisma.courtBooking.create({
      data: {
        courtId: bookedCourt.id,
        playerId: player.id,
        status: "CONFIRMED",
        startsAt: new Date("2026-06-21T16:00:00.000Z"),
        endsAt: new Date("2026-06-22T16:00:00.000Z"),
        quotedAmount: "300.00",
        proofDeadline: new Date("2026-06-21T16:00:00.000Z"),
      },
    });

    const results = await discovery.search({
      cityMunicipality: "Quezon City",
      availableDate: "2026-06-22",
      durationMin: 60,
    });
    expect(results.map((r) => r.venue.slug)).toEqual(["disc-open"]);
    expect(results[0]?.availableCourtCount).toBe(1);

    await prisma.courtBooking.deleteMany({ where: { courtId: bookedCourt.id } });
    await prisma.user.deleteMany({ where: { email: { endsWith: "@disc.test" } } });
    void open;
  });
});
