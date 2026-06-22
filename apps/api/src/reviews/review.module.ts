import { Module } from "@nestjs/common";
// biome-ignore lint/style/useImportType: PrismaClient is used as a Nest provider token.
import { PrismaClient } from "@courtlink/database";
import { PRISMA_CLIENT } from "../auth/tokens.js";
import { PrismaReviewRepository } from "./prisma-review.repository.js";
import { ReviewController } from "./review.controller.js";
import { ReviewService } from "./review.service.js";

@Module({
  controllers: [ReviewController],
  providers: [
    {
      provide: PrismaReviewRepository,
      useFactory: (prisma: PrismaClient) => new PrismaReviewRepository(prisma),
      inject: [PRISMA_CLIENT],
    },
    {
      provide: ReviewService,
      useFactory: (repo: PrismaReviewRepository) => new ReviewService(repo),
      inject: [PrismaReviewRepository],
    },
  ],
  exports: [ReviewService],
})
export class ReviewModule {}
