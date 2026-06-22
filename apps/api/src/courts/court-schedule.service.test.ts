import { describe, expect, it } from "vitest";
import type { ClosureWindow, OperatingWindow } from "./availability-policy.js";
import type { ClosureInput, OperatingWindowInput } from "./court.service.js";
import {
  type CourtScheduleRepository,
  CourtScheduleService,
  ScheduleManagementError,
} from "./court-schedule.service.js";

class FakeScheduleRepository implements CourtScheduleRepository {
  operatingHours: OperatingWindow[] = [];
  closures: ClosureWindow[] = [];

  async getSchedule() {
    return { operatingHours: this.operatingHours, closures: this.closures };
  }

  async replaceOperatingHours(courtId: string, windows: OperatingWindowInput[]) {
    this.operatingHours = windows.map((window, index) => ({
      id: `hours-${index + 1}`,
      courtId,
      ...window,
    }));
    return this.operatingHours;
  }

  async createClosure(input: ClosureInput) {
    const closure: ClosureWindow = {
      id: `closure-${this.closures.length + 1}`,
      courtId: input.courtId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      reason: input.reason ?? null,
    };
    this.closures.push(closure);
    return closure;
  }

  async deleteClosure(_courtId: string, closureId: string) {
    const index = this.closures.findIndex((closure) => closure.id === closureId);
    if (index < 0) return false;
    this.closures.splice(index, 1);
    return true;
  }
}

describe("CourtScheduleService", () => {
  it("sorts and atomically replaces valid weekly windows", async () => {
    const repository = new FakeScheduleRepository();
    const service = new CourtScheduleService(repository);

    const result = await service.replaceOperatingHours("court-1", [
      { dayOfWeek: 2, opensMinute: 600, closesMinute: 720 },
      { dayOfWeek: 1, opensMinute: 480, closesMinute: 600 },
      { dayOfWeek: 1, opensMinute: 660, closesMinute: 780 },
    ]);

    expect(result.map(({ dayOfWeek, opensMinute }) => [dayOfWeek, opensMinute])).toEqual([
      [1, 480],
      [1, 660],
      [2, 600],
    ]);
  });

  it.each([
    [[{ dayOfWeek: -1, opensMinute: 480, closesMinute: 600 }], "OPERATING_HOURS_INVALID"],
    [[{ dayOfWeek: 1, opensMinute: 600, closesMinute: 600 }], "OPERATING_HOURS_INVALID"],
    [
      [
        { dayOfWeek: 1, opensMinute: 480, closesMinute: 660 },
        { dayOfWeek: 1, opensMinute: 600, closesMinute: 720 },
      ],
      "OPERATING_HOURS_OVERLAP",
    ],
  ])("rejects invalid or overlapping windows", async (windows, code) => {
    const service = new CourtScheduleService(new FakeScheduleRepository());
    await expect(
      service.replaceOperatingHours("court-1", windows as OperatingWindowInput[]),
    ).rejects.toMatchObject({ code });
  });

  it("validates closure ranges and normalizes an optional reason", async () => {
    const repository = new FakeScheduleRepository();
    const service = new CourtScheduleService(repository);
    await expect(
      service.createClosure({
        courtId: "court-1",
        startsAt: new Date("2026-06-22T02:00:00.000Z"),
        endsAt: new Date("2026-06-22T01:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "CLOSURE_RANGE_INVALID" });

    const closure = await service.createClosure({
      courtId: "court-1",
      startsAt: new Date("2026-06-22T01:00:00.000Z"),
      endsAt: new Date("2026-06-22T02:00:00.000Z"),
      reason: "  Maintenance  ",
    });
    expect(closure.reason).toBe("Maintenance");
  });

  it("returns a stable error when deleting an unknown closure", async () => {
    const service = new CourtScheduleService(new FakeScheduleRepository());
    await expect(service.deleteClosure("court-1", "missing")).rejects.toBeInstanceOf(
      ScheduleManagementError,
    );
    await expect(service.deleteClosure("court-1", "missing")).rejects.toMatchObject({
      code: "CLOSURE_NOT_FOUND",
    });
  });
});
