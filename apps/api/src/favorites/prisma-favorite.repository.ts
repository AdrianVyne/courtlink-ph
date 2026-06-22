import type { PrismaClient } from "@courtlink/database";
import type { FavoriteRepository, FavoriteVenueSummary } from "./favorite.service.js";

export class PrismaFavoriteRepository implements FavoriteRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async venueExists(venueId: string): Promise<boolean> {
    return (await this.prisma.venue.count({ where: { id: venueId } })) > 0;
  }

  async add(userId: string, venueId: string): Promise<void> {
    await this.prisma.favoriteVenue.upsert({
      where: { userId_venueId: { userId, venueId } },
      create: { userId, venueId },
      update: {},
    });
  }

  async remove(userId: string, venueId: string): Promise<void> {
    await this.prisma.favoriteVenue.deleteMany({ where: { userId, venueId } });
  }

  async list(userId: string): Promise<FavoriteVenueSummary[]> {
    const rows = await this.prisma.favoriteVenue.findMany({
      where: { userId },
      include: { venue: { select: { id: true, name: true, slug: true, cityMunicipality: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => ({
      id: row.venue.id,
      name: row.venue.name,
      slug: row.venue.slug,
      cityMunicipality: row.venue.cityMunicipality,
      createdAt: row.createdAt,
    }));
  }

  async isFavorite(userId: string, venueId: string): Promise<boolean> {
    return (await this.prisma.favoriteVenue.count({ where: { userId, venueId } })) > 0;
  }
}
