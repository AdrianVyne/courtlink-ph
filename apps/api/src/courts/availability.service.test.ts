import { describe, expect, it } from "vitest";
import type { ClosureWindow, OperatingWindow } from "./availability-policy.js";
import { AvailabilityService } from "./availability.service.js";
import type {
  BlockingBookingInterval,
  ClosureInput,
  CourtRepository,
  CourtSummary,
  OperatingWindowInput,
  PricingRule,
} from "./court.service.js";

class FakeAvailabilityRepository implements CourtRepository {
  court: CourtSummary = {
    id: "court-1",
    venueId: "venue-1",
    name: "Court One",
    description: null,
    indoor: true,
    active: true,
    slotIncrementMin: 30,
    minimumDurationMin: 60,
    maximumDurationMin: 120,
  };
  operatingHours: OperatingWindow[] = [
    {
      id: "hours-1",
      courtId: "court-1",
      dayOfWeek: 1,
      opensMinute: 480,
      closesMinute: 660,
    },
  ];
  closures: ClosureWindow[] = [
    {
      id: "closure-1",
      courtId: "court-1",
      startsAt: new Date("2026-06-22T00:30:00.000Z"),
      endsAt: new Date("2026-06-22T01:00:00.000Z"),
      reason: "Maintenance",
    },
  ];
  bookings: BlockingBookingInterval[] = [
    {
      id: "booking-1",
      startsAt: new Date("2026-06-22T02:00:00.000Z"),
      endsAt: new Date("2026-06-22T03:00:00.000Z"),
    },
  ];
  rules: PricingRule[] = [
    {
      id: "rule-1",
      dayOfWeek: 1,
      startsMinute: 540,
      endsMinute: 600,
      pricePerHour: 250,
      priority: 0,
      effectiveFrom: null,
      effectiveUntil: null,
    },
  ];

  async findCourtById() {
    return this.court;
  }
  async getSchedule() {
    return { operatingHours: this.operatingHours, closures: this.closures };
  }
  async listPricingRules() {
    return this.rules;
  }
  async listBlockingBookings(_courtId: string, startsAt: Date, endsAt: Date) {
    return this.bookings.filter(
      (booking) => booking.startsAt < endsAt && booking.endsAt > startsAt,
    );
  }
  async createCourt() {
    return this.court;
  }
  async listCourtsForVenue() {
    return [this.court];
  }
  async replaceOperatingHours(_courtId: string, _windows: OperatingWindowInput[]) {
    return this.operatingHours;
  }
  async createClosure(input: ClosureInput) {
    return { id: "created", reason: input.reason ?? null, ...input };
  }
  async deleteClosure() {
    return false;
  }
}

describe("AvailabilityService", () => {
  it("returns only closure-free, booking-free, priced slots", async () => {
    const service = new AvailabilityService(new FakeAvailabilityRepository());

    const slots = await service.listPricedSlots("court-1", "2026-06-22", 60);

    expect(slots).toEqual([
      {
        startsAt: new Date("2026-06-22T01:00:00.000Z"),
        endsAt: new Date("2026-06-22T02:00:00.000Z"),
        totalAmount: 250,
        currency: "PHP",
      },
    ]);
  });

  it("rejects inactive courts and invalid dates", async () => {
    const repository = new FakeAvailabilityRepository();
    repository.court = { ...repository.court, active: false };
    const service = new AvailabilityService(repository);
    await expect(service.listPricedSlots("court-1", "2026-06-22", 60)).rejects.toMatchObject({
      code: "COURT_NOT_AVAILABLE",
    });

    repository.court = { ...repository.court, active: true };
    await expect(service.listPricedSlots("court-1", "bad-date", 60)).rejects.toMatchObject({
      code: "DATE_INVALID",
    });
  });
});
