import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR, Reflector } from "@nestjs/core";
// biome-ignore lint/style/useImportType: PrismaClient is used as a Nest provider token.
import { PrismaClient } from "@courtlink/database";
import { PRISMA_CLIENT } from "../auth/tokens.js";
import { IdempotencyInterceptor } from "./idempotency.interceptor.js";
import { PrismaIdempotencyRepository } from "./prisma-idempotency.repository.js";

@Module({
  providers: [
    Reflector,
    {
      provide: "IDEMPOTENCY_REPOSITORY",
      useFactory: (prisma: PrismaClient) => new PrismaIdempotencyRepository(prisma),
      inject: [PRISMA_CLIENT],
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
  exports: ["IDEMPOTENCY_REPOSITORY"],
})
export class IdempotencyModule {}
