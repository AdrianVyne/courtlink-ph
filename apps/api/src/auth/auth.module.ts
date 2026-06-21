import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@courtlink/database";
import { Inject, Module, type OnApplicationShutdown } from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
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
      provide: PRISMA_CLIENT,
      useFactory: () => {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) throw new Error("DATABASE_URL is required");
        return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
      },
    },
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
  exports: [AuthService, PRISMA_CLIENT],
})
export class AuthModule implements OnApplicationShutdown {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async onApplicationShutdown(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
