import { Module } from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
// biome-ignore lint/style/useImportType: PrismaClient is used as a Nest provider token.
import { PrismaClient } from "@courtlink/database";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { PasswordHasher } from "./password-hasher.js";
import { PrismaAuthRepository } from "./prisma-auth.repository.js";
import { SessionGuard } from "./session.guard.js";
import { PRISMA_CLIENT, SECURE_COOKIES } from "./tokens.js";

@Module({
  controllers: [AuthController],
  providers: [
    Reflector,
    {
      provide: SECURE_COOKIES,
      useFactory: () => process.env.NODE_ENV === "production",
    },
    PasswordHasher,
    {
      provide: PrismaAuthRepository,
      useFactory: (prisma: PrismaClient) => new PrismaAuthRepository(prisma),
      inject: [PRISMA_CLIENT],
    },
    {
      provide: AuthService,
      useFactory: (repo: PrismaAuthRepository, hasher: PasswordHasher) =>
        new AuthService(repo, hasher),
      inject: [PrismaAuthRepository, PasswordHasher],
    },
    {
      provide: APP_GUARD,
      useClass: SessionGuard,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
