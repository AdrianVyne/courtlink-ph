import { Module } from "@nestjs/common";
// biome-ignore lint/style/useImportType: PrismaClient is used as a Nest provider token.
import { PrismaClient } from "@courtlink/database";
import { PRISMA_CLIENT } from "../auth/tokens.js";
import { ModerationController } from "./moderation.controller.js";
import { ModerationService } from "./moderation.service.js";
import { PrismaModerationRepository } from "./prisma-moderation.repository.js";

@Module({
  controllers: [ModerationController],
  providers: [
    {
      provide: PrismaModerationRepository,
      useFactory: (prisma: PrismaClient) => new PrismaModerationRepository(prisma),
      inject: [PRISMA_CLIENT],
    },
    {
      provide: ModerationService,
      useFactory: (repo: PrismaModerationRepository) => new ModerationService(repo),
      inject: [PrismaModerationRepository],
    },
  ],
  exports: [ModerationService],
})
export class ModerationModule {}
