import { Module } from "@nestjs/common";
// biome-ignore lint/style/useImportType: PrismaClient is used as a Nest provider token.
import { PrismaClient } from "@courtlink/database";
import { PRISMA_CLIENT } from "../auth/tokens.js";
import { AmenityController } from "./amenity.controller.js";
import { AmenityService } from "./amenity.service.js";
import { PrismaAmenityRepository } from "./prisma-amenity.repository.js";

@Module({
  controllers: [AmenityController],
  providers: [
    {
      provide: PrismaAmenityRepository,
      useFactory: (prisma: PrismaClient) => new PrismaAmenityRepository(prisma),
      inject: [PRISMA_CLIENT],
    },
    {
      provide: AmenityService,
      useFactory: (repo: PrismaAmenityRepository) => new AmenityService(repo),
      inject: [PrismaAmenityRepository],
    },
    {
      provide: AmenityController,
      useFactory: (amenities: AmenityService) => new AmenityController(amenities),
      inject: [AmenityService],
    },
  ],
  exports: [AmenityService],
})
export class AmenityModule {}
