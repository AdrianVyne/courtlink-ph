import { describe, expect, it } from "vitest";
import type { CourtSummary } from "./court.service.js";
import {
  type ClosureWindow,
  type OperatingWindow,
  ScheduleError,
  generateCandidateIntervals,
  intervalsOverlap,
  manilaParts,
  validateScheduledInterval,
} from "./availability-policy.js";

const court: CourtSummary = {
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

const mondayWindow: OperatingWindow = {
  id: "hours-1",
  courtId: court.id,
  dayOfWeek: 1,
  opensMinute: 480,
  closesMinute: 600,
};
const mondayHours: OperatingWindow[] = [mondayWindow];

function expectCode(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error("Expected schedule error");
  } catch (error) {
    expect(error).toBeInstanceOf(ScheduleError);
    expect((error as ScheduleError).code).toBe(code);
  }
}

describe("manilaParts", () => {
  it("converts UTC to the next Manila calendar day", () => {
    expect(manilaParts(new Date("2026-06-21T23:30:00.000Z"))).toEqual({
      date: "2026-06-22",
      dayOfWeek: 1,
      minuteOfDay: 450,
    });
  });
});

describe("validateScheduledInterval", () => {
  it("accepts an aligned interval contained in one operating window", () => {
    expect(
      validateScheduledInterval(
        court,
        mondayHours,
        [],
        new Date("2026-06-22T00:00:00.000Z"),
        new Date("2026-06-22T01:00:00.000Z"),
      ),
    ).toEqual({ windowId: "hours-1" });
  });

  it("is closed by default and rejects starts misaligned from opening", () => {
    expectCode(
      () =>
        validateScheduledInterval(
          court,
          [],
          [],
          new Date("2026-06-22T00:00:00.000Z"),
          new Date("2026-06-22T01:00:00.000Z"),
        ),
      "COURT_CLOSED",
    );
    expectCode(
      () =>
        validateScheduledInterval(
          court,
          mondayHours,
          [],
          new Date("2026-06-22T00:15:00.000Z"),
          new Date("2026-06-22T01:15:00.000Z"),
        ),
      "COURT_SLOT_MISALIGNED",
    );
  });

  it("rejects cross-day and closure-overlapping intervals", () => {
    expectCode(
      () =>
        validateScheduledInterval(
          court,
          [{ ...mondayWindow, closesMinute: 1_440 }],
          [],
          new Date("2026-06-22T15:00:00.000Z"),
          new Date("2026-06-22T16:00:00.000Z"),
        ),
      "COURT_CROSS_DAY",
    );

    const closure: ClosureWindow = {
      id: "closure-1",
      courtId: court.id,
      startsAt: new Date("2026-06-22T00:30:00.000Z"),
      endsAt: new Date("2026-06-22T01:30:00.000Z"),
      reason: "Maintenance",
    };
    expectCode(
      () =>
        validateScheduledInterval(
          court,
          mondayHours,
          [closure],
          new Date("2026-06-22T00:00:00.000Z"),
          new Date("2026-06-22T01:00:00.000Z"),
        ),
      "COURT_CLOSURE_CONFLICT",
    );
  });
});

describe("generateCandidateIntervals", () => {
  it("generates opening-relative UTC candidates for a Manila date", () => {
    expect(generateCandidateIntervals(court, mondayHours, "2026-06-22", 60)).toEqual([
      {
        startsAt: new Date("2026-06-22T00:00:00.000Z"),
        endsAt: new Date("2026-06-22T01:00:00.000Z"),
      },
      {
        startsAt: new Date("2026-06-22T00:30:00.000Z"),
        endsAt: new Date("2026-06-22T01:30:00.000Z"),
      },
      {
        startsAt: new Date("2026-06-22T01:00:00.000Z"),
        endsAt: new Date("2026-06-22T02:00:00.000Z"),
      },
    ]);
  });

  it("rejects invalid dates and durations", () => {
    expectCode(
      () => generateCandidateIntervals(court, mondayHours, "06/22/2026", 60),
      "DATE_INVALID",
    );
    expectCode(
      () => generateCandidateIntervals(court, mondayHours, "2026-06-22", 45),
      "DURATION_INVALID",
    );
  });
});

describe("intervalsOverlap", () => {
  it("treats touching boundaries as non-overlapping", () => {
    expect(
      intervalsOverlap(
        new Date("2026-06-22T00:00:00.000Z"),
        new Date("2026-06-22T01:00:00.000Z"),
        new Date("2026-06-22T01:00:00.000Z"),
        new Date("2026-06-22T02:00:00.000Z"),
      ),
    ).toBe(false);
  });
});
