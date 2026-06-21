import { Module } from "@nestjs/common";
// biome-ignore lint/style/useImportType: PrismaClient is used as a Nest provider token.
import { PrismaClient } from "@courtlink/database";
import { TenancyController } from "./tenancy.controller.js";
import { TenancyService } from "./tenancy.service.js";
import { PrismaTenancyRepository } from "./prisma-tenancy.repository.js";
import { PRISMA_CLIENT } from "../auth/tokens.js";

@Module({
  controllers: [TenancyController],
  providers: [
    {
      provide: PrismaTenancyRepository,
      useFactory: (prisma: PrismaClient) => new PrismaTenancyRepository(prisma),
      inject: [PRISMA_CLIENT],
    },
    {
      provide: TenancyService,
      useFactory: (repo: PrismaTenancyRepository) => new TenancyService(repo),
      inject: [PrismaTenancyRepository],
    },
  ],
  exports: [TenancyService],
})
export class TenancyModule {}
