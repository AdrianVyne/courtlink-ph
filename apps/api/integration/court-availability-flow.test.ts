import { PrismaPg } from "@prisma/adapter-pg";
import { BookingStatus, PrismaClient } from "@courtlink/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { BookingService } from "../src/courts/booking.service.js";
import { PrismaBookingRepository } from "../src/courts/prisma-booking.repository.js";
import { PrismaCourtRepository } from "../src/courts/prisma-court.repository.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for court availability tests");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const courtRepository = new PrismaCourtRepository(prisma);
const bookings = new BookingService(new PrismaBookingRepository(prisma), courtRepository);

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

beforeEach(cleanup);

async function cleanup() {
  await prisma.courtBooking.deleteMany({
    where: { player: { email: { endsWith: "@availability.integration.test" } } },
  });
  await prisma.courtClosure.deleteMany({
    where: { court: { venue: { slug: { startsWith: "availability-" } } } },
  });
  await prisma.courtOperatingHour.deleteMany({
    where: { court: { venue: { slug: { startsWith: "availability-" } } } },
  });
  await prisma.courtPricingRule.deleteMany({
    where: { court: { venue: { slug: { startsWith: "availability-" } } } },
  });
  await prisma.court.deleteMany({ where: { venue: { slug: { startsWith: "availability-" } } } });
  await prisma.venue.deleteMany({ where: { slug: { startsWith: "availability-" } } });
  await prisma.business.deleteMany({ where: { name: { startsWith: "AVAILABILITY " } } });
  await prisma.user.deleteMany({
    where: { email: { endsWith: "@availability.integration.test" } },
  });
}

async function fixture() {
  const suffix = crypto.randomUUID();
  const [playerOne, playerTwo] = await Promise.all([
    prisma.user.create({
      data: {
        email: `one-${suffix}@availability.integration.test`,
        displayName: "Player One",
      },
    }),
    prisma.user.create({
      data: {
        email: `two-${suffix}@availability.integration.test`,
        displayName: "Player Two",
      },
    }),
  ]);
  const business = await prisma.business.create({ data: { name: `AVAILABILITY ${suffix}` } });
  const venue = await prisma.venue.create({
    data: {
      businessId: business.id,
      name: "Availability Venue",
      slug: `availability-${suffix}`,
      status: "APPROVED",
      approvedAt: new Date(),
      regionCode: "NCR",
      cityMunicipality: "Manila",
      streetAddress: "1 Schedule Street",
    },
  });
  const court = await prisma.court.create({
    data: {
      venueId: venue.id,
      name: "Court One",
      slotIncrementMin: 30,
      minimumDurationMin: 60,
      maximumDurationMin: 120,
    },
  });
  await prisma.courtPricingRule.create({
    data: {
      courtId: court.id,
      startsMinute: 0,
      endsMinute: 1_440,
      pricePerHour: "250.00",
    },
  });
  await courtRepository.replaceOperatingHours(court.id, [
    { dayOfWeek: 1, opensMinute: 480, closesMinute: 720 },
  ]);
  return { court, playerOne, playerTwo };
}

describe("court schedule enforcement", () => {
  it("enforces closures, refund-requested blocking, and concurrent overlap protection", async () => {
    const { court, playerOne, playerTwo } = await fixture();
    const eightToNine = {
      startsAt: new Date("2026-06-22T00:00:00.000Z"),
      endsAt: new Date("2026-06-22T01:00:00.000Z"),
    };
    const first = await bookings.createHold({
      courtId: court.id,
      playerId: playerOne.id,
      ...eightToNine,
    });

    await prisma.courtBooking.update({
      where: { id: first.id },
      data: { status: BookingStatus.REFUND_REQUESTED },
    });
    await expect(
      courtRepository.createClosure({
        courtId: court.id,
        startsAt: new Date("2026-06-22T00:30:00.000Z"),
        endsAt: new Date("2026-06-22T01:30:00.000Z"),
        reason: "Maintenance",
      }),
    ).rejects.toMatchObject({ code: "CLOSURE_BOOKINGS_EXIST" });
    await expect(
      bookings.createHold({ courtId: court.id, playerId: playerTwo.id, ...eightToNine }),
    ).rejects.toMatchObject({ code: "COURT_BOOKING_CONFLICT" });

    await courtRepository.createClosure({
      courtId: court.id,
      startsAt: new Date("2026-06-22T02:00:00.000Z"),
      endsAt: new Date("2026-06-22T03:00:00.000Z"),
      reason: "Court maintenance",
    });
    await expect(
      bookings.createHold({
        courtId: court.id,
        playerId: playerTwo.id,
        startsAt: new Date("2026-06-22T02:00:00.000Z"),
        endsAt: new Date("2026-06-22T03:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "COURT_CLOSURE_CONFLICT" });

    const nineToTen = {
      startsAt: new Date("2026-06-22T01:00:00.000Z"),
      endsAt: new Date("2026-06-22T02:00:00.000Z"),
    };
    const results = await Promise.allSettled([
      bookings.createHold({ courtId: court.id, playerId: playerOne.id, ...nineToTen }),
      bookings.createHold({ courtId: court.id, playerId: playerTwo.id, ...nineToTen }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({ reason: { code: "COURT_BOOKING_CONFLICT" } });

    const elevenToNoon = {
      startsAt: new Date("2026-06-22T03:00:00.000Z"),
      endsAt: new Date("2026-06-22T04:00:00.000Z"),
    };
    const closureAndHold = await Promise.allSettled([
      courtRepository.createClosure({
        courtId: court.id,
        ...elevenToNoon,
        reason: "Emergency maintenance",
      }),
      bookings.createHold({ courtId: court.id, playerId: playerTwo.id, ...elevenToNoon }),
    ]);
    expect(closureAndHold.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  });
});
