import { Module } from "@nestjs/common";
// biome-ignore lint/style/useImportType: PrismaClient is used as a Nest provider token.
import { PrismaClient } from "@courtlink/database";
import { PRISMA_CLIENT } from "../auth/tokens.js";
import { AmenityModule } from "../amenities/amenity.module.js";
import { AmenityService } from "../amenities/amenity.service.js";
import { TenancyModule } from "../tenancy/tenancy.module.js";
import { TenancyService } from "../tenancy/tenancy.service.js";
import { DiscoveryService } from "./discovery.service.js";
import { PrismaDiscoveryRepository } from "./prisma-discovery.repository.js";
import { PrismaVenueRepository } from "./prisma-venue.repository.js";
import { VenueController } from "./venue.controller.js";
import { VenueService } from "./venue.service.js";

@Module({
  imports: [TenancyModule, AmenityModule],
  controllers: [VenueController],
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
      provide: VenueController,
      useFactory: (
        venues: VenueService,
        tenancy: TenancyService,
        discovery: DiscoveryService,
        amenities: AmenityService,
      ) => new VenueController(venues, tenancy, discovery, amenities),
      inject: [VenueService, TenancyService, DiscoveryService, AmenityService],
    },
  ],
  exports: [VenueService],
})
export class VenueModule {}
