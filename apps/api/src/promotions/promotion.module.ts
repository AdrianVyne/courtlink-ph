import { Module } from "@nestjs/common";
// biome-ignore lint/style/useImportType: PrismaClient is used as a Nest provider token.
import { PrismaClient } from "@courtlink/database";
import { PRISMA_CLIENT } from "../auth/tokens.js";
import { TenancyModule } from "../tenancy/tenancy.module.js";
import { TenancyService } from "../tenancy/tenancy.service.js";
import { VenueModule } from "../venues/venue.module.js";
import { VenueService } from "../venues/venue.service.js";
import { PrismaPromotionRepository } from "./prisma-promotion.repository.js";
import { PromotionController } from "./promotion.controller.js";
import { PromotionService } from "./promotion.service.js";

@Module({
  imports: [TenancyModule, VenueModule],
  controllers: [PromotionController],
  providers: [
    {
      provide: PrismaPromotionRepository,
      useFactory: (prisma: PrismaClient) => new PrismaPromotionRepository(prisma),
      inject: [PRISMA_CLIENT],
    },
    {
      provide: PromotionService,
      useFactory: (repo: PrismaPromotionRepository) => new PromotionService(repo),
      inject: [PrismaPromotionRepository],
    },
    {
      provide: PromotionController,
      useFactory: (promotions: PromotionService, tenancy: TenancyService, venues: VenueService) =>
        new PromotionController(promotions, tenancy, venues),
      inject: [PromotionService, TenancyService, VenueService],
    },
  ],
  exports: [PromotionService],
})
export class PromotionModule {}
