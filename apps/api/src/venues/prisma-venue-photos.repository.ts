import type { PrismaClient, VenuePhoto } from "@courtlink/database";
import type { VenuePhotoRecord, VenuePhotoRepository } from "./venue-photos.service.js";

function toRecord(photo: VenuePhoto): VenuePhotoRecord {
  return {
    id: photo.id,
    venueId: photo.venueId,
    objectKey: photo.objectKey,
    altText: photo.altText,
    position: photo.position,
    createdAt: photo.createdAt,
  };
}

export class PrismaVenuePhotosRepository implements VenuePhotoRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async countForVenue(venueId: string): Promise<number> {
    return this.prisma.venuePhoto.count({ where: { venueId } });
  }

  async listForVenue(venueId: string): Promise<VenuePhotoRecord[]> {
    const photos = await this.prisma.venuePhoto.findMany({
      where: { venueId },
      orderBy: { position: "asc" },
    });
    return photos.map(toRecord);
  }

  async create(input: {
    venueId: string;
    objectKey: string;
    altText: string;
    position: number;
  }): Promise<VenuePhotoRecord> {
    return toRecord(await this.prisma.venuePhoto.create({ data: input }));
  }

  async findById(photoId: string): Promise<VenuePhotoRecord | null> {
    const photo = await this.prisma.venuePhoto.findUnique({ where: { id: photoId } });
    return photo ? toRecord(photo) : null;
  }

  async update(
    photoId: string,
    patch: { altText?: string; position?: number },
  ): Promise<VenuePhotoRecord> {
    return toRecord(await this.prisma.venuePhoto.update({ where: { id: photoId }, data: patch }));
  }

  async swapPositions(photoIdA: string, photoIdB: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const [a, b] = await Promise.all([
        tx.venuePhoto.findUniqueOrThrow({ where: { id: photoIdA } }),
        tx.venuePhoto.findUniqueOrThrow({ where: { id: photoIdB } }),
      ]);
      // Three-step swap keeps the (venueId, position) unique constraint happy.
      await tx.venuePhoto.update({ where: { id: a.id }, data: { position: -1 } });
      await tx.venuePhoto.update({ where: { id: b.id }, data: { position: a.position } });
      await tx.venuePhoto.update({ where: { id: a.id }, data: { position: b.position } });
    });
  }

  async delete(photoId: string): Promise<void> {
    await this.prisma.venuePhoto.delete({ where: { id: photoId } });
  }
}
