import { describe, expect, it } from "vitest";
import {
  CourtService,
  type CourtRepository,
  type CourtSummary,
  type CreateCourtInput,
  type PricingRule,
  type QuoteInput,
  QuoteError,
  quoteCourtBooking,
} from "./court.service.js";

class InMemoryCourtRepository implements CourtRepository {
  readonly courts: CourtSummary[] = [];
  readonly rules = new Map<string, PricingRule[]>();

  async createCourt(input: CreateCourtInput): Promise<CourtSummary> {
    const summary: CourtSummary = {
      id: `court-${this.courts.length + 1}`,
      venueId: input.venueId,
      name: input.name,
      description: input.description ?? null,
      indoor: input.indoor ?? false,
      active: true,
      slotIncrementMin: input.slotIncrementMin ?? 30,
      minimumDurationMin: input.minimumDurationMin ?? 60,
      maximumDurationMin: input.maximumDurationMin ?? 240,
    };
    this.courts.push(summary);
    return summary;
  }

  async listCourtsForVenue(venueId: string): Promise<CourtSummary[]> {
    return this.courts.filter((c) => c.venueId === venueId);
  }

  async findCourtById(id: string): Promise<CourtSummary | null> {
    return this.courts.find((c) => c.id === id) ?? null;
  }

  async listPricingRules(courtId: string): Promise<PricingRule[]> {
    return this.rules.get(courtId) ?? [];
  }
}

function quoteInput(startIso: string, endIso: string): QuoteInput {
  return { startsAt: new Date(startIso), endsAt: new Date(endIso) };
}

function baseCourt(overrides: Partial<CourtSummary> = {}): CourtSummary {
  return {
    id: "court-1",
    venueId: "venue-1",
    name: "Court A",
    description: null,
    indoor: false,
    active: true,
    slotIncrementMin: 30,
    minimumDurationMin: 60,
    maximumDurationMin: 240,
    ...overrides,
  };
}

describe("CourtService", () => {
  it("creates a court with sane defaults", async () => {
    const service = new CourtService(new InMemoryCourtRepository());
    const court = await service.createCourt({ venueId: "venue-1", name: "  Court A " });
    expect(court).toMatchObject({ name: "Court A", indoor: false, active: true });
  });
});

describe("quoteCourtBooking", () => {
  const dayRule: PricingRule = {
    id: "rule-day",
    dayOfWeek: null,
    startsMinute: 6 * 60,
    endsMinute: 18 * 60,
    pricePerHour: 200,
    priority: 0,
    effectiveFrom: null,
    effectiveUntil: null,
  };
  const peakRule: PricingRule = {
    id: "rule-peak",
    dayOfWeek: null,
    startsMinute: 18 * 60,
    endsMinute: 22 * 60,
    pricePerHour: 350,
    priority: 10,
    effectiveFrom: null,
    effectiveUntil: null,
  };

  it("uses the matching rule and computes price proportional to duration", () => {
    // 07:00-08:30 Manila on 2026-06-22 -> 23:00 prev day to 00:30 UTC
    const quote = quoteCourtBooking(
      baseCourt(),
      [dayRule, peakRule],
      quoteInput("2026-06-21T23:00:00.000Z", "2026-06-22T00:30:00.000Z"),
    );
    expect(quote.totalAmount).toBe(300);
    expect(quote.ruleId).toBe("rule-day");
  });

  it("prefers higher-priority rules when ranges overlap on time", () => {
    // 18:00 Manila start -> 10:00 UTC
    const quote = quoteCourtBooking(
      baseCourt(),
      [dayRule, peakRule],
      quoteInput("2026-06-22T10:00:00.000Z", "2026-06-22T11:00:00.000Z"),
    );
    expect(quote.ruleId).toBe("rule-peak");
    expect(quote.totalAmount).toBe(350);
  });

  it("rejects durations below the minimum or off slot increments", () => {
    expect(() =>
      quoteCourtBooking(
        baseCourt(),
        [dayRule],
        quoteInput("2026-06-21T23:00:00.000Z", "2026-06-21T23:30:00.000Z"),
      ),
    ).toThrow(QuoteError);
    expect(() =>
      quoteCourtBooking(
        baseCourt({ slotIncrementMin: 60 }),
        [dayRule],
        quoteInput("2026-06-21T23:00:00.000Z", "2026-06-22T00:30:00.000Z"),
      ),
    ).toThrow(QuoteError);
  });

  it("rejects when no rule covers the requested time", () => {
    expect(() =>
      quoteCourtBooking(
        baseCourt(),
        [dayRule],
        quoteInput("2026-06-22T13:00:00.000Z", "2026-06-22T14:00:00.000Z"),
      ),
    ).toThrow(QuoteError);
  });
});
