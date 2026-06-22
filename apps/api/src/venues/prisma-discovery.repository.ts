import { type Prisma, type PrismaClient, VenueStatus } from "@courtlink/database";
import { toCourtSummary, toPricingRule } from "../courts/court.service.js";
import { toVenueSummary } from "./venue.service.js";
import type {
  DiscoveryCourtCandidate,
  DiscoveryFilters,
  DiscoveryRepository,
  DiscoveryVenueCandidate,
} from "./discovery.service.js";

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_BOOKING_STATUSES = [
  "HELD",
  "PROOF_SUBMITTED",
  "CONFIRMED",
  "REFUND_REQUESTED",
] as const;
const CANDIDATE_CAP = 200;

// A Manila calendar day maps to a UTC window starting 8 hours earlier.
function manilaDayWindow(date: string): { start: Date; end: Date } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const midnightUtc = Date.UTC(year, month - 1, day) - MANILA_OFFSET_MS;
  return { start: new Date(midnightUtc), end: new Date(midnightUtc + DAY_MS) };
}

function buildWhere(filters: DiscoveryFilters): Prisma.VenueWhereInput {
  const where: Prisma.VenueWhereInput = { status: VenueStatus.APPROVED };
  if (filters.regionCode) where.regionCode = filters.regionCode;
  if (filters.provinceCode) where.provinceCode = filters.provinceCode;
  if (filters.cityMunicipality) where.cityMunicipality = filters.cityMunicipality;
  if (filters.query) {
    where.OR = [
      { name: { contains: filters.query, mode: "insensitive" } },
      { description: { contains: filters.query, mode: "insensitive" } },
    ];
  }
  const amenities = (filters.amenities ?? []).filter(Boolean);
  if (amenities.length > 0) {
    where.AND = amenities.map((key) => ({
      amenities: { some: { amenity: { key } } },
    }));
  }
  return where;
}

export class PrismaDiscoveryRepository implements DiscoveryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async search(filters: DiscoveryFilters): Promise<DiscoveryVenueCandidate[]> {
    const window = filters.availableDate ? manilaDayWindow(filters.availableDate) : null;
    const closuresArg = window
      ? { where: { startsAt: { lt: window.end }, endsAt: { gt: window.start } } }
      : { take: 0 };
    const bookingsArg = window
      ? {
          where: {
            status: { in: [...ACTIVE_BOOKING_STATUSES] },
            startsAt: { lt: window.end },
            endsAt: { gt: window.start },
          },
          select: { startsAt: true, endsAt: true },
        }
      : { take: 0, select: { startsAt: true, endsAt: true } };

    const venues = await this.prisma.venue.findMany({
      where: buildWhere(filters),
      orderBy: { name: "asc" },
      take: CANDIDATE_CAP,
      include: {
        amenities: { include: { amenity: true } },
        courts: {
          where: { active: true },
          include: {
            operatingHours: true,
            pricingRules: true,
            closures: closuresArg,
            bookings: bookingsArg,
          },
        },
      },
    });

    return venues.map((venue) => {
      const courts: DiscoveryCourtCandidate[] = venue.courts.map((court) => ({
        court: toCourtSummary(court),
        operatingHours: court.operatingHours.map((hour) => ({
          id: hour.id,
          courtId: hour.courtId,
          dayOfWeek: hour.dayOfWeek,
          opensMinute: hour.opensMinute,
          closesMinute: hour.closesMinute,
        })),
        closures: court.closures.map((closure) => ({
          id: closure.id,
          courtId: closure.courtId,
          startsAt: closure.startsAt,
          endsAt: closure.endsAt,
          reason: closure.reason,
        })),
        pricingRules: court.pricingRules.map(toPricingRule),
        bookings: court.bookings.map((booking) => ({
          startsAt: booking.startsAt,
          endsAt: booking.endsAt,
        })),
      }));
      const candidate: DiscoveryVenueCandidate = {
        venue: toVenueSummary(venue),
        amenityKeys: venue.amenities.map((entry) => entry.amenity.key),
        courts,
      };
      return candidate;
    });
  }
}
