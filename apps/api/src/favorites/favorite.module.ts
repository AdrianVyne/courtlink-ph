import { Module } from "@nestjs/common";
// biome-ignore lint/style/useImportType: PrismaClient is used as a Nest provider token.
import { PrismaClient } from "@courtlink/database";
import { PRISMA_CLIENT } from "../auth/tokens.js";
import { FavoriteController } from "./favorite.controller.js";
import { FavoriteService } from "./favorite.service.js";
import { PrismaFavoriteRepository } from "./prisma-favorite.repository.js";

@Module({
  controllers: [FavoriteController],
  providers: [
    {
      provide: PrismaFavoriteRepository,
      useFactory: (prisma: PrismaClient) => new PrismaFavoriteRepository(prisma),
      inject: [PRISMA_CLIENT],
    },
    {
      provide: FavoriteService,
      useFactory: (repo: PrismaFavoriteRepository) => new FavoriteService(repo),
      inject: [PrismaFavoriteRepository],
    },
  ],
  exports: [FavoriteService],
})
export class FavoriteModule {}
