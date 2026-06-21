import { Module } from "@nestjs/common";
// biome-ignore lint/style/useImportType: PrismaClient is used as a Nest provider token.
import { PrismaClient } from "@courtlink/database";
import { PRISMA_CLIENT } from "../auth/tokens.js";
import { TenancyModule } from "../tenancy/tenancy.module.js";
// biome-ignore lint/style/useImportType: TenancyService is injected at runtime.
import { TenancyService } from "../tenancy/tenancy.service.js";
import { PrismaVenueRepository } from "./prisma-venue.repository.js";
import { VenueController } from "./venue.controller.js";
import { VenueService } from "./venue.service.js";

@Module({
  imports: [TenancyModule],
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
      provide: VenueController,
      useFactory: (venues: VenueService, tenancy: TenancyService) =>
        new VenueController(venues, tenancy),
      inject: [VenueService, TenancyService],
    },
  ],
  exports: [VenueService],
})
export class VenueModule {}
