import { Module } from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
import type { EmailSender } from "../notifications/notification.service.js";
// biome-ignore lint/style/useImportType: PrismaClient is used as a Nest provider token.
import { PrismaClient } from "@courtlink/database";
import { AccountSecurityService } from "./account-security.service.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { PasswordHasher } from "./password-hasher.js";
import { PrismaAccountSecurityRepository } from "./prisma-account-security.repository.js";
import { PrismaAuthRepository } from "./prisma-auth.repository.js";
import { SessionGuard } from "./session.guard.js";
import { APP_BASE_URL, EMAIL_SENDER, PRISMA_CLIENT, SECURE_COOKIES } from "./tokens.js";

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
      provide: APP_BASE_URL,
      useFactory: () => process.env.APP_BASE_URL ?? "http://localhost:3000",
    },
    {
      provide: PrismaAccountSecurityRepository,
      useFactory: (prisma: PrismaClient) => new PrismaAccountSecurityRepository(prisma),
      inject: [PRISMA_CLIENT],
    },
    {
      provide: AccountSecurityService,
      useFactory: (
        repo: PrismaAccountSecurityRepository,
        email: EmailSender,
        hasher: PasswordHasher,
        baseUrl: string,
      ) => new AccountSecurityService(repo, email, hasher, baseUrl),
      inject: [PrismaAccountSecurityRepository, EMAIL_SENDER, PasswordHasher, APP_BASE_URL],
    },
    {
      provide: APP_GUARD,
      useClass: SessionGuard,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
