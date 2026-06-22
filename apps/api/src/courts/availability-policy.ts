import type { CourtSummary } from "./court.service.js";

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface OperatingWindow {
  id: string;
  courtId: string;
  dayOfWeek: number;
  opensMinute: number;
  closesMinute: number;
}

export interface ClosureWindow {
  id: string;
  courtId: string;
  startsAt: Date;
  endsAt: Date;
  reason: string | null;
}

export interface CandidateInterval {
  startsAt: Date;
  endsAt: Date;
}

export class ScheduleError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ScheduleError";
  }
}

export function manilaParts(date: Date): {
  date: string;
  dayOfWeek: number;
  minuteOfDay: number;
} {
  const manila = new Date(date.getTime() + MANILA_OFFSET_MS);
  const year = manila.getUTCFullYear();
  const month = String(manila.getUTCMonth() + 1).padStart(2, "0");
  const day = String(manila.getUTCDate()).padStart(2, "0");
  return {
    date: `${year}-${month}-${day}`,
    dayOfWeek: manila.getUTCDay(),
    minuteOfDay: manila.getUTCHours() * 60 + manila.getUTCMinutes(),
  };
}

export function intervalsOverlap(
  firstStart: Date,
  firstEnd: Date,
  secondStart: Date,
  secondEnd: Date,
): boolean {
  return firstStart < secondEnd && firstEnd > secondStart;
}

function validateDuration(court: CourtSummary, startsAt: Date, endsAt: Date): number {
  const durationMin = (endsAt.getTime() - startsAt.getTime()) / MINUTE_MS;
  if (
    !Number.isInteger(durationMin) ||
    durationMin < court.minimumDurationMin ||
    durationMin > court.maximumDurationMin ||
    durationMin % court.slotIncrementMin !== 0
  ) {
    throw new ScheduleError("DURATION_INVALID", "Duration is outside court booking rules");
  }
  return durationMin;
}

export function validateScheduledInterval(
  court: CourtSummary,
  operatingHours: OperatingWindow[],
  closures: ClosureWindow[],
  startsAt: Date,
  endsAt: Date,
): { windowId: string } {
  validateDuration(court, startsAt, endsAt);
  const start = manilaParts(startsAt);
  const end = manilaParts(endsAt);
  if (start.date !== end.date) {
    throw new ScheduleError("COURT_CROSS_DAY", "Bookings must remain on one Manila date");
  }

  const windows = operatingHours.filter((window) => window.dayOfWeek === start.dayOfWeek);
  const containing = windows.find(
    (window) => window.opensMinute <= start.minuteOfDay && window.closesMinute >= end.minuteOfDay,
  );
  if (!containing) throw new ScheduleError("COURT_CLOSED", "Court is closed for this interval");
  if ((start.minuteOfDay - containing.opensMinute) % court.slotIncrementMin !== 0) {
    throw new ScheduleError("COURT_SLOT_MISALIGNED", "Start must align with the court schedule");
  }
  if (
    closures.some((closure) => intervalsOverlap(startsAt, endsAt, closure.startsAt, closure.endsAt))
  ) {
    throw new ScheduleError("COURT_CLOSURE_CONFLICT", "Court is closed for this interval");
  }
  return { windowId: containing.id };
}

function parseManilaDate(value: string): {
  year: number;
  month: number;
  day: number;
  dayOfWeek: number;
} {
  const match = DATE_PATTERN.exec(value);
  if (!match) throw new ScheduleError("DATE_INVALID", "Date must use YYYY-MM-DD");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new ScheduleError("DATE_INVALID", "Date is not a valid calendar date");
  }
  return { year, month, day, dayOfWeek: parsed.getUTCDay() };
}

export function generateCandidateIntervals(
  court: CourtSummary,
  operatingHours: OperatingWindow[],
  manilaDate: string,
  durationMin: number,
): CandidateInterval[] {
  const date = parseManilaDate(manilaDate);
  if (
    !Number.isInteger(durationMin) ||
    durationMin < court.minimumDurationMin ||
    durationMin > court.maximumDurationMin ||
    durationMin % court.slotIncrementMin !== 0
  ) {
    throw new ScheduleError("DURATION_INVALID", "Duration is outside court booking rules");
  }

  const midnightUtc = Date.UTC(date.year, date.month - 1, date.day) - MANILA_OFFSET_MS;
  const candidates: CandidateInterval[] = [];
  for (const window of operatingHours
    .filter((item) => item.dayOfWeek === date.dayOfWeek)
    .sort((left, right) => left.opensMinute - right.opensMinute)) {
    for (
      let startsMinute = window.opensMinute;
      startsMinute + durationMin <= window.closesMinute;
      startsMinute += court.slotIncrementMin
    ) {
      const startsAt = new Date(midnightUtc + startsMinute * MINUTE_MS);
      candidates.push({
        startsAt,
        endsAt: new Date(startsAt.getTime() + durationMin * MINUTE_MS),
      });
    }
  }
  return candidates;
}
