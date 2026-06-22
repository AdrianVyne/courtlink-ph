import type { ClosureWindow, OperatingWindow } from "./availability-policy.js";
import type { ClosureInput, CourtRepository, OperatingWindowInput } from "./court.service.js";

export type CourtScheduleRepository = Pick<
  CourtRepository,
  "getSchedule" | "replaceOperatingHours" | "createClosure" | "deleteClosure"
>;

export class ScheduleManagementError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ScheduleManagementError";
  }
}

function validateWindow(window: OperatingWindowInput): void {
  if (
    !Number.isInteger(window.dayOfWeek) ||
    window.dayOfWeek < 0 ||
    window.dayOfWeek > 6 ||
    !Number.isInteger(window.opensMinute) ||
    !Number.isInteger(window.closesMinute) ||
    window.opensMinute < 0 ||
    window.opensMinute > 1_439 ||
    window.closesMinute < 1 ||
    window.closesMinute > 1_440 ||
    window.opensMinute >= window.closesMinute
  ) {
    throw new ScheduleManagementError(
      "OPERATING_HOURS_INVALID",
      "Operating hours must be positive same-day Manila windows",
    );
  }
}

function sortedWindows(windows: OperatingWindowInput[]): OperatingWindowInput[] {
  const sorted = windows
    .map((window) => ({ ...window }))
    .sort((left, right) => {
      return left.dayOfWeek - right.dayOfWeek || left.opensMinute - right.opensMinute;
    });
  for (const window of sorted) validateWindow(window);
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (
      previous &&
      current &&
      previous.dayOfWeek === current.dayOfWeek &&
      current.opensMinute < previous.closesMinute
    ) {
      throw new ScheduleManagementError(
        "OPERATING_HOURS_OVERLAP",
        "Operating windows on the same day cannot overlap",
      );
    }
  }
  return sorted;
}

export class CourtScheduleService {
  constructor(private readonly repository: CourtScheduleRepository) {}

  getSchedule(courtId: string): Promise<{
    operatingHours: OperatingWindow[];
    closures: ClosureWindow[];
  }> {
    return this.repository.getSchedule(courtId);
  }

  async replaceOperatingHours(
    courtId: string,
    windows: OperatingWindowInput[],
  ): Promise<OperatingWindow[]> {
    return this.repository.replaceOperatingHours(courtId, sortedWindows(windows));
  }

  async createClosure(input: ClosureInput): Promise<ClosureWindow> {
    if (
      !Number.isFinite(input.startsAt.getTime()) ||
      !Number.isFinite(input.endsAt.getTime()) ||
      input.endsAt <= input.startsAt
    ) {
      throw new ScheduleManagementError(
        "CLOSURE_RANGE_INVALID",
        "Closure end must be after its start",
      );
    }
    const reason = input.reason?.trim();
    return this.repository.createClosure({ ...input, reason: reason || null });
  }

  async deleteClosure(courtId: string, closureId: string): Promise<void> {
    const deleted = await this.repository.deleteClosure(courtId, closureId);
    if (!deleted) {
      throw new ScheduleManagementError("CLOSURE_NOT_FOUND", "Closure not found");
    }
  }
}
