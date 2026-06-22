import type { Court, CourtPricingRule } from "@courtlink/database";

import type { ClosureWindow, OperatingWindow } from "./availability-policy.js";

export interface CourtSummary {
  id: string;
  venueId: string;
  name: string;
  description: string | null;
  indoor: boolean;
  active: boolean;
  slotIncrementMin: number;
  minimumDurationMin: number;
  maximumDurationMin: number;
}

export interface CreateCourtInput {
  venueId: string;
  name: string;
  description?: string | null | undefined;
  indoor?: boolean | undefined;
  slotIncrementMin?: number | undefined;
  minimumDurationMin?: number | undefined;
  maximumDurationMin?: number | undefined;
}

export interface PricingRule {
  id: string;
  dayOfWeek: number | null;
  startsMinute: number;
  endsMinute: number;
  pricePerHour: number;
  priority: number;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
}

export interface OperatingWindowInput {
  dayOfWeek: number;
  opensMinute: number;
  closesMinute: number;
}

export interface ClosureInput {
  courtId: string;
  startsAt: Date;
  endsAt: Date;
  reason?: string | null;
}

export interface BlockingBookingInterval {
  id: string;
  startsAt: Date;
  endsAt: Date;
}

export interface CourtRepository {
  createCourt(input: CreateCourtInput): Promise<CourtSummary>;
  listCourtsForVenue(venueId: string): Promise<CourtSummary[]>;
  findCourtById(id: string): Promise<CourtSummary | null>;
  listPricingRules(courtId: string): Promise<PricingRule[]>;
  getSchedule(courtId: string): Promise<{
    operatingHours: OperatingWindow[];
    closures: ClosureWindow[];
  }>;
  replaceOperatingHours(
    courtId: string,
    windows: OperatingWindowInput[],
  ): Promise<OperatingWindow[]>;
  createClosure(input: ClosureInput): Promise<ClosureWindow>;
  deleteClosure(courtId: string, closureId: string): Promise<boolean>;
  listBlockingBookings(
    courtId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<BlockingBookingInterval[]>;
}

export class CourtService {
  constructor(private readonly repository: CourtRepository) {}

  createCourt(input: CreateCourtInput): Promise<CourtSummary> {
    if (input.name.trim().length < 1) throw new Error("COURT_NAME_REQUIRED");
    return this.repository.createCourt({
      ...input,
      name: input.name.trim(),
    });
  }

  listCourtsForVenue(venueId: string): Promise<CourtSummary[]> {
    return this.repository.listCourtsForVenue(venueId);
  }

  findCourtById(id: string): Promise<CourtSummary | null> {
    return this.repository.findCourtById(id);
  }

  listPricingRules(courtId: string): Promise<PricingRule[]> {
    return this.repository.listPricingRules(courtId);
  }
}

export interface QuoteInput {
  startsAt: Date;
  endsAt: Date;
}

export interface Quote {
  totalAmount: number;
  currency: "PHP";
  ruleId: string;
}

export class QuoteError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "QuoteError";
  }
}

export function quoteCourtBooking(
  court: CourtSummary,
  rules: PricingRule[],
  input: QuoteInput,
): Quote {
  const durationMs = input.endsAt.getTime() - input.startsAt.getTime();
  if (durationMs <= 0) throw new QuoteError("QUOTE_INVALID_RANGE", "endsAt must be after startsAt");
  const minutes = durationMs / (60 * 1000);
  if (minutes < court.minimumDurationMin)
    throw new QuoteError("QUOTE_DURATION_TOO_SHORT", "Duration below minimum");
  if (minutes > court.maximumDurationMin)
    throw new QuoteError("QUOTE_DURATION_TOO_LONG", "Duration exceeds maximum");
  if (minutes % court.slotIncrementMin !== 0)
    throw new QuoteError("QUOTE_INVALID_INCREMENT", "Duration must align with slot increments");

  const startMinutes = startMinutesOfDay(input.startsAt);
  const dayOfWeek = manilaDayOfWeek(input.startsAt);

  const applicable = rules
    .filter((rule) => isRuleEffective(rule, input.startsAt))
    .filter((rule) => rule.dayOfWeek === null || rule.dayOfWeek === dayOfWeek)
    .filter((rule) => rule.startsMinute <= startMinutes && rule.endsMinute > startMinutes)
    .sort((a, b) => b.priority - a.priority);

  const rule = applicable[0];
  if (!rule) throw new QuoteError("QUOTE_NO_PRICING_RULE", "No pricing rule matches this slot");

  const totalAmount = round2((minutes / 60) * rule.pricePerHour);
  return { totalAmount, currency: "PHP", ruleId: rule.id };
}

function startMinutesOfDay(date: Date): number {
  // Convert to Asia/Manila time using fixed +08:00 (no DST).
  const manila = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return manila.getUTCHours() * 60 + manila.getUTCMinutes();
}

function manilaDayOfWeek(date: Date): number {
  const manila = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return manila.getUTCDay();
}

function isRuleEffective(rule: PricingRule, when: Date): boolean {
  if (rule.effectiveFrom && when < rule.effectiveFrom) return false;
  if (rule.effectiveUntil && when >= rule.effectiveUntil) return false;
  return true;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function toCourtSummary(court: Court): CourtSummary {
  return {
    id: court.id,
    venueId: court.venueId,
    name: court.name,
    description: court.description,
    indoor: court.indoor,
    active: court.active,
    slotIncrementMin: court.slotIncrementMin,
    minimumDurationMin: court.minimumDurationMin,
    maximumDurationMin: court.maximumDurationMin,
  };
}

export function toPricingRule(rule: CourtPricingRule): PricingRule {
  return {
    id: rule.id,
    dayOfWeek: rule.dayOfWeek,
    startsMinute: rule.startsMinute,
    endsMinute: rule.endsMinute,
    pricePerHour: Number(rule.pricePerHour),
    priority: rule.priority,
    effectiveFrom: rule.effectiveFrom,
    effectiveUntil: rule.effectiveUntil,
  };
}
