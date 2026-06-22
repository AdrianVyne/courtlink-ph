import type { PrismaClient } from "@courtlink/database";
import type { AmenityCatalogEntry, AmenityRepository, AmenityScope } from "./amenity.service.js";

type AmenityRow = { id: string; key: string; name: string; scope: AmenityScope };

function toEntry(row: AmenityRow): AmenityCatalogEntry {
  return { id: row.id, key: row.key, name: row.name, scope: row.scope };
}

export class PrismaAmenityRepository implements AmenityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listCatalog(): Promise<AmenityCatalogEntry[]> {
    const rows = await this.prisma.amenity.findMany({
      orderBy: [{ scope: "asc" }, { key: "asc" }],
    });
    return rows.map(toEntry);
  }

  async findByKeys(keys: string[]): Promise<AmenityCatalogEntry[]> {
    const rows = await this.prisma.amenity.findMany({ where: { key: { in: keys } } });
    return rows.map(toEntry);
  }

  async setVenueAmenities(venueId: string, amenityIds: string[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.venueAmenity.deleteMany({ where: { venueId } }),
      this.prisma.venueAmenity.createMany({
        data: amenityIds.map((amenityId) => ({ venueId, amenityId })),
        skipDuplicates: true,
      }),
    ]);
  }

  async setCourtAmenities(courtId: string, amenityIds: string[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.courtAmenity.deleteMany({ where: { courtId } }),
      this.prisma.courtAmenity.createMany({
        data: amenityIds.map((amenityId) => ({ courtId, amenityId })),
        skipDuplicates: true,
      }),
    ]);
  }

  async listVenueAmenities(venueId: string): Promise<AmenityCatalogEntry[]> {
    const rows = await this.prisma.venueAmenity.findMany({
      where: { venueId },
      include: { amenity: true },
      orderBy: { amenity: { key: "asc" } },
    });
    return rows.map((row) => toEntry(row.amenity));
  }

  async listCourtAmenities(courtId: string): Promise<AmenityCatalogEntry[]> {
    const rows = await this.prisma.courtAmenity.findMany({
      where: { courtId },
      include: { amenity: true },
      orderBy: { amenity: { key: "asc" } },
    });
    return rows.map((row) => toEntry(row.amenity));
  }
}
