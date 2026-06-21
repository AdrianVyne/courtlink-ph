import { type Prisma, type PrismaClient, VenueStatus } from "@courtlink/database";
import {
  type CreateVenueInput,
  type PublicVenueFilters,
  type VenueRepository,
  type VenueSummary,
  toVenueSummary,
} from "./venue.service.js";

function buildPublicWhere(filters: PublicVenueFilters): Prisma.VenueWhereInput {
  const where: Prisma.VenueWhereInput = { status: VenueStatus.APPROVED };
  if (filters.regionCode) where.regionCode = filters.regionCode;
  if (filters.cityMunicipality) where.cityMunicipality = filters.cityMunicipality;
  if (filters.query) {
    where.OR = [
      { name: { contains: filters.query, mode: "insensitive" } },
      { description: { contains: filters.query, mode: "insensitive" } },
    ];
  }
  return where;
}

export class PrismaVenueRepository implements VenueRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createVenue(input: CreateVenueInput): Promise<VenueSummary> {
    const venue = await this.prisma.venue.create({
      data: {
        businessId: input.businessId,
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        regionCode: input.regionCode,
        provinceCode: input.provinceCode ?? null,
        cityMunicipality: input.cityMunicipality,
        barangay: input.barangay ?? null,
        streetAddress: input.streetAddress,
      },
    });
    return toVenueSummary(venue);
  }

  async findVenueById(id: string): Promise<VenueSummary | null> {
    const venue = await this.prisma.venue.findUnique({ where: { id } });
    return venue ? toVenueSummary(venue) : null;
  }

  async findVenueBySlug(slug: string): Promise<VenueSummary | null> {
    const venue = await this.prisma.venue.findUnique({ where: { slug } });
    return venue ? toVenueSummary(venue) : null;
  }

  async listPublicVenues(filters: PublicVenueFilters): Promise<VenueSummary[]> {
    const venues = await this.prisma.venue.findMany({
      where: buildPublicWhere(filters),
      orderBy: { name: "asc" },
      take: filters.limit ?? 50,
    });
    return venues.map(toVenueSummary);
  }

  async listVenuesForBusiness(businessId: string): Promise<VenueSummary[]> {
    const venues = await this.prisma.venue.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
    });
    return venues.map(toVenueSummary);
  }

  async approveVenue(id: string, approvedAt: Date): Promise<VenueSummary> {
    const venue = await this.prisma.venue.update({
      where: { id },
      data: { status: VenueStatus.APPROVED, approvedAt },
    });
    return toVenueSummary(venue);
  }

  async rejectVenue(id: string): Promise<VenueSummary> {
    const venue = await this.prisma.venue.update({
      where: { id },
      data: { status: VenueStatus.REJECTED },
    });
    return toVenueSummary(venue);
  }

  async submitForReview(id: string): Promise<VenueSummary> {
    const venue = await this.prisma.venue.update({
      where: { id },
      data: { status: VenueStatus.PENDING_APPROVAL },
    });
    return toVenueSummary(venue);
  }
}
