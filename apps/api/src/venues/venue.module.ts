import { Module } from "@nestjs/common";
// biome-ignore lint/style/useImportType: PrismaClient is used as a Nest provider token.
import { PrismaClient } from "@courtlink/database";
import { OBJECT_STORAGE, PRISMA_CLIENT } from "../auth/tokens.js";
import { AmenityModule } from "../amenities/amenity.module.js";
import { AmenityService } from "../amenities/amenity.service.js";
import type { ObjectStorage } from "../storage/object-storage.js";
import { reencodePhotoImage } from "../storage/reencode-photo.js";
import { TenancyModule } from "../tenancy/tenancy.module.js";
import { TenancyService } from "../tenancy/tenancy.service.js";
import { DiscoveryService } from "./discovery.service.js";
import { PrismaDiscoveryRepository } from "./prisma-discovery.repository.js";
import { PrismaPublicStatsRepository } from "./prisma-public-stats.repository.js";
import { PrismaVenuePhotosRepository } from "./prisma-venue-photos.repository.js";
import { PrismaVenueRepository } from "./prisma-venue.repository.js";
import { PublicStatsController } from "./public-stats.controller.js";
import { PublicStatsService } from "./public-stats.service.js";
import { VenuePhotosController } from "./venue-photos.controller.js";
import { VenuePhotoService } from "./venue-photos.service.js";
import { VenueController } from "./venue.controller.js";
import { VenueService } from "./venue.service.js";

@Module({
  imports: [TenancyModule, AmenityModule],
  controllers: [VenueController, PublicStatsController, VenuePhotosController],
  providers: [
    {
      provide: PrismaVenueRepository,
      useFactory: (prisma: PrismaClient) => new PrismaVenueRepository(prisma),
      inject: [PRISMA_CLIENT],
    },
    {
      provide: VenueService,
      useFactory: (repo: PrismaVenueRepository) => new VenueService(repo),
      inject: [PrismaVenueRepository],
    },
    {
      provide: PrismaDiscoveryRepository,
      useFactory: (prisma: PrismaClient) => new PrismaDiscoveryRepository(prisma),
      inject: [PRISMA_CLIENT],
    },
    {
      provide: DiscoveryService,
      useFactory: (repo: PrismaDiscoveryRepository) => new DiscoveryService(repo),
      inject: [PrismaDiscoveryRepository],
    },
    {
      provide: PrismaPublicStatsRepository,
      useFactory: (prisma: PrismaClient) => new PrismaPublicStatsRepository(prisma),
      inject: [PRISMA_CLIENT],
    },
    {
      provide: PublicStatsService,
      useFactory: (repo: PrismaPublicStatsRepository) => new PublicStatsService(repo),
      inject: [PrismaPublicStatsRepository],
    },
    {
      provide: PublicStatsController,
      useFactory: (stats: PublicStatsService) => new PublicStatsController(stats),
      inject: [PublicStatsService],
    },
    {
      provide: PrismaVenuePhotosRepository,
      useFactory: (prisma: PrismaClient) => new PrismaVenuePhotosRepository(prisma),
      inject: [PRISMA_CLIENT],
    },
    {
      provide: VenuePhotoService,
      useFactory: (
        photos: PrismaVenuePhotosRepository,
        venues: PrismaVenueRepository,
        tenancy: TenancyService,
        storage: ObjectStorage,
      ) =>
        new VenuePhotoService({
          photos,
          venues,
          tenancy,
          storage,
          reencode: reencodePhotoImage,
        }),
      inject: [PrismaVenuePhotosRepository, PrismaVenueRepository, TenancyService, OBJECT_STORAGE],
    },
    {
      provide: VenuePhotosController,
      useFactory: (photos: VenuePhotoService) => new VenuePhotosController(photos),
      inject: [VenuePhotoService],
    },
    {
      provide: VenueController,
      useFactory: (
        venues: VenueService,
        tenancy: TenancyService,
        discovery: DiscoveryService,
        amenities: AmenityService,
        photos: VenuePhotoService,
      ) => new VenueController(venues, tenancy, discovery, amenities, photos),
      inject: [VenueService, TenancyService, DiscoveryService, AmenityService, VenuePhotoService],
    },
  ],
  exports: [VenueService],
})
export class VenueModule {}
