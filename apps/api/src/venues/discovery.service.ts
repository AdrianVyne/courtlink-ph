import {
  type ClosureWindow,
  type OperatingWindow,
  ScheduleError,
  generateCandidateIntervals,
  intervalsOverlap,
  manilaParts,
} from "../courts/availability-policy.js";
import {
  type CourtSummary,
  type PricingRule,
  QuoteError,
  quoteCourtBooking,
} from "../courts/court.service.js";
import type { VenueSummary } from "./venue.service.js";

export interface DiscoveryCourtCandidate {
  court: CourtSummary;
  operatingHours: OperatingWindow[];
  closures: ClosureWindow[];
  pricingRules: PricingRule[];
  bookings: { startsAt: Date; endsAt: Date }[];
}

export interface DiscoveryVenueCandidate {
  venue: VenueSummary;
  amenityKeys: string[];
  courts: DiscoveryCourtCandidate[];
}

export interface DiscoveryFilters {
  regionCode?: string | undefined;
  provinceCode?: string | undefined;
  cityMunicipality?: string | undefined;
  query?: string | undefined;
  amenities?: string[] | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  availableDate?: string | undefined;
  durationMin?: number | undefined;
  earliestMinute?: number | undefined;
  latestMinute?: number | undefined;
  limit?: number | undefined;
}

export interface DiscoveryVenueResult {
  venue: VenueSummary;
  amenities: string[];
  fromPrice: number | null;
  availableCourtCount: number;
}

export interface VenueEvaluation {
  matches: boolean;
  availableCourtCount: number;
  fromPrice: number | null;
}

export interface DiscoveryRepository {
  search(filters: DiscoveryFilters): Promise<DiscoveryVenueCandidate[]>;
}

function withinRange(price: number, min: number | undefined, max: number | undefined): boolean {
  if (min !== undefined && price < min) return false;
  if (max !== undefined && price > max) return false;
  return true;
}

function evaluatePriceOnly(
  candidate: DiscoveryVenueCandidate,
  filters: DiscoveryFilters,
): VenueEvaluation {
  const hasPriceFilter = filters.minPrice !== undefined || filters.maxPrice !== undefined;
  let cheapest: number | null = null;
  for (const entry of candidate.courts) {
    if (!entry.court.active) continue;
    for (const rule of entry.pricingRules) {
      if (hasPriceFilter && !withinRange(rule.pricePerHour, filters.minPrice, filters.maxPrice)) {
        continue;
      }
      if (cheapest === null || rule.pricePerHour < cheapest) cheapest = rule.pricePerHour;
    }
  }
  const matches = hasPriceFilter ? cheapest !== null : true;
  return { matches, availableCourtCount: 0, fromPrice: cheapest };
}

function evaluateAvailability(
  candidate: DiscoveryVenueCandidate,
  filters: DiscoveryFilters,
): VenueEvaluation {
  const durationMin = filters.durationMin ?? 60;
  let availableCourtCount = 0;
  let cheapest: number | null = null;

  for (const entry of candidate.courts) {
    if (!entry.court.active) continue;
    let intervals: ReturnType<typeof generateCandidateIntervals>;
    try {
      intervals = generateCandidateIntervals(
        entry.court,
        entry.operatingHours,
        filters.availableDate as string,
        durationMin,
      );
    } catch (error) {
      if (error instanceof ScheduleError) continue;
      throw error;
    }
    let courtHasSlot = false;
    for (const interval of intervals) {
      const startMinute = manilaParts(interval.startsAt).minuteOfDay;
      const endMinute = startMinute + durationMin;
      if (filters.earliestMinute !== undefined && startMinute < filters.earliestMinute) continue;
      if (filters.latestMinute !== undefined && endMinute > filters.latestMinute) continue;
      const blockedByClosure = entry.closures.some((closure) =>
        intervalsOverlap(interval.startsAt, interval.endsAt, closure.startsAt, closure.endsAt),
      );
      if (blockedByClosure) continue;
      const blockedByBooking = entry.bookings.some((booking) =>
        intervalsOverlap(interval.startsAt, interval.endsAt, booking.startsAt, booking.endsAt),
      );
      if (blockedByBooking) continue;
      let price: number;
      try {
        price = quoteCourtBooking(entry.court, entry.pricingRules, interval).totalAmount;
      } catch (error) {
        if (error instanceof QuoteError) continue;
        throw error;
      }
      const pricePerHour = Math.round(((price / durationMin) * 60 + Number.EPSILON) * 100) / 100;
      if (!withinRange(pricePerHour, filters.minPrice, filters.maxPrice)) continue;
      courtHasSlot = true;
      if (cheapest === null || pricePerHour < cheapest) cheapest = pricePerHour;
    }
    if (courtHasSlot) availableCourtCount += 1;
  }

  return { matches: availableCourtCount > 0, availableCourtCount, fromPrice: cheapest };
}

export function evaluateVenue(
  candidate: DiscoveryVenueCandidate,
  filters: DiscoveryFilters,
): VenueEvaluation {
  if (filters.availableDate) return evaluateAvailability(candidate, filters);
  return evaluatePriceOnly(candidate, filters);
}

export class DiscoveryService {
  constructor(private readonly repository: DiscoveryRepository) {}

  async search(filters: DiscoveryFilters): Promise<DiscoveryVenueResult[]> {
    const limit = filters.limit ?? 50;
    const candidates = await this.repository.search(filters);
    const results: DiscoveryVenueResult[] = [];
    for (const candidate of candidates) {
      const evaluation = evaluateVenue(candidate, filters);
      if (!evaluation.matches) continue;
      results.push({
        venue: candidate.venue,
        amenities: candidate.amenityKeys,
        fromPrice: evaluation.fromPrice,
        availableCourtCount: evaluation.availableCourtCount,
      });
      if (results.length >= limit) break;
    }
    return results;
  }
}
