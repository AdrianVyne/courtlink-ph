import { describe, expect, it } from "vitest";
import {
  type DiscoveryCourtCandidate,
  type DiscoveryFilters,
  type DiscoveryVenueCandidate,
  evaluateVenue,
} from "./discovery.service.js";
import type { VenueSummary } from "./venue.service.js";

function venue(id: string): VenueSummary {
  return {
    id,
    businessId: "b1",
    name: `Venue ${id}`,
    slug: id,
    description: null,
    status: "APPROVED",
    regionCode: "NCR",
    provinceCode: null,
    cityMunicipality: "Manila",
    barangay: null,
    streetAddress: "1 St",
    timezone: "Asia/Manila",
    approvedAt: new Date(),
  };
}

function court(
  id: string,
  pricePerHour: number,
  opts: Partial<DiscoveryCourtCandidate> = {},
): DiscoveryCourtCandidate {
  return {
    court: {
      id,
      venueId: "v1",
      name: id,
      description: null,
      indoor: false,
      active: true,
      slotIncrementMin: 60,
      minimumDurationMin: 60,
      maximumDurationMin: 240,
    },
    operatingHours: Array.from({ length: 7 }, (_, dayOfWeek) => ({
      id: `${id}-${dayOfWeek}`,
      courtId: id,
      dayOfWeek,
      opensMinute: 0,
      closesMinute: 1440,
    })),
    closures: [],
    pricingRules: [
      {
        id: `${id}-rule`,
        dayOfWeek: null,
        startsMinute: 0,
        endsMinute: 1440,
        pricePerHour: pricePerHour,
        priority: 0,
        effectiveFrom: null,
        effectiveUntil: null,
      },
    ],
    bookings: [],
    ...opts,
  };
}

function candidate(
  courts: DiscoveryCourtCandidate[],
  amenityKeys: string[] = [],
): DiscoveryVenueCandidate {
  return { venue: venue("v1"), amenityKeys, courts };
}

// 2026-06-22 is a Monday; 01:00-02:00 UTC == 09:00-10:00 Manila.
const DATE = "2026-06-22";

describe("evaluateVenue price-only (no date)", () => {
  it("matches when a court price falls in range and reports the cheapest", () => {
    const c = candidate([court("c1", 250), court("c2", 500)]);
    const result = evaluateVenue(c, { minPrice: 200, maxPrice: 400 } as DiscoveryFilters);
    expect(result.matches).toBe(true);
    expect(result.fromPrice).toBe(250);
  });

  it("does not match when all prices are out of range", () => {
    const c = candidate([court("c1", 800)]);
    const result = evaluateVenue(c, { maxPrice: 400 } as DiscoveryFilters);
    expect(result.matches).toBe(false);
  });

  it("matches with no filters and reports overall cheapest price", () => {
    const c = candidate([court("c1", 700), court("c2", 300)]);
    const result = evaluateVenue(c, {} as DiscoveryFilters);
    expect(result.matches).toBe(true);
    expect(result.fromPrice).toBe(300);
  });
});

describe("evaluateVenue availability (date provided)", () => {
  it("matches when a court has an open priced slot for the duration", () => {
    const c = candidate([court("c1", 250)]);
    const result = evaluateVenue(c, {
      availableDate: DATE,
      durationMin: 60,
    } as DiscoveryFilters);
    expect(result.matches).toBe(true);
    expect(result.availableCourtCount).toBe(1);
    expect(result.fromPrice).toBe(250);
  });

  it("excludes a court fully blocked by a booking at every slot", () => {
    const blocked = court("c1", 250, {
      bookings: [
        {
          startsAt: new Date("2026-06-21T16:00:00.000Z"),
          endsAt: new Date("2026-06-22T16:00:00.000Z"),
        },
      ],
    });
    const result = evaluateVenue(candidate([blocked]), {
      availableDate: DATE,
      durationMin: 60,
    } as DiscoveryFilters);
    expect(result.matches).toBe(false);
    expect(result.availableCourtCount).toBe(0);
  });

  it("respects an earliest/latest Manila minute window", () => {
    // Only allow slots starting at or after 09:00 and ending by 10:00 Manila.
    const result = evaluateVenue(candidate([court("c1", 250)]), {
      availableDate: DATE,
      durationMin: 60,
      earliestMinute: 540,
      latestMinute: 600,
    } as DiscoveryFilters);
    expect(result.matches).toBe(true);
    expect(result.availableCourtCount).toBe(1);
  });

  it("excludes slots whose price exceeds the max", () => {
    const result = evaluateVenue(candidate([court("c1", 900)]), {
      availableDate: DATE,
      durationMin: 60,
      maxPrice: 400,
    } as DiscoveryFilters);
    expect(result.matches).toBe(false);
  });

  it("ignores a court whose duration rules cannot satisfy the request", () => {
    const tiny = court("c1", 250);
    tiny.court.maximumDurationMin = 60;
    const result = evaluateVenue(candidate([tiny]), {
      availableDate: DATE,
      durationMin: 120,
    } as DiscoveryFilters);
    expect(result.matches).toBe(false);
  });
});
