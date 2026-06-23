import { Module } from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
import type { EmailSender } from "../notifications/notification.service.js";
// biome-ignore lint/style/useImportType: PrismaClient is used as a Nest provider token.
import { PrismaClient } from "@courtlink/database";
import { AccountSecurityService } from "./account-security.service.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { GoogleOAuthClient } from "./google-oauth.client.js";
import { GoogleOAuthService } from "./google-oauth.service.js";
import { PasswordHasher } from "./password-hasher.js";
import { PrismaAccountSecurityRepository } from "./prisma-account-security.repository.js";
import { PrismaAuthRepository } from "./prisma-auth.repository.js";
import { PrismaGoogleOAuthRepository } from "./prisma-google-oauth.repository.js";
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
      provide: PrismaGoogleOAuthRepository,
      useFactory: (prisma: PrismaClient) => new PrismaGoogleOAuthRepository(prisma),
      inject: [PRISMA_CLIENT],
    },
    {
      provide: GoogleOAuthClient,
      useFactory: () =>
        new GoogleOAuthClient(
          process.env.GOOGLE_CLIENT_ID ?? "",
          process.env.GOOGLE_CLIENT_SECRET ?? "",
          process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3001/api/v1/auth/google/callback",
        ),
    },
    {
      provide: GoogleOAuthService,
      useFactory: (
        repository: PrismaGoogleOAuthRepository,
        provider: GoogleOAuthClient,
        sessions: AuthService,
      ) =>
        new GoogleOAuthService(repository, provider, sessions, {
          enabled: process.env.GOOGLE_OAUTH_ENABLED === "true",
          redirectUri:
            process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3001/api/v1/auth/google/callback",
        }),
      inject: [PrismaGoogleOAuthRepository, GoogleOAuthClient, AuthService],
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
