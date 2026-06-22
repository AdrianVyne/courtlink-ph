import { Module } from "@nestjs/common";
// biome-ignore lint/style/useImportType: PrismaClient is used as a Nest provider token.
import { PrismaClient } from "@courtlink/database";
import type { EmailSender } from "../notifications/notification.service.js";
import { APP_BASE_URL, EMAIL_SENDER, PRISMA_CLIENT } from "../auth/tokens.js";
import { OrganizationStaffService } from "./organization-staff.service.js";
import { PrismaOrganizationStaffRepository } from "./prisma-organization-staff.repository.js";
import { PrismaTenancyRepository } from "./prisma-tenancy.repository.js";
import { TenancyController } from "./tenancy.controller.js";
import { TenancyService } from "./tenancy.service.js";

@Module({
  controllers: [TenancyController],
  providers: [
    {
      provide: APP_BASE_URL,
      useFactory: () => process.env.APP_BASE_URL ?? "http://localhost:3000",
    },
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
    {
      provide: PrismaOrganizationStaffRepository,
      useFactory: (prisma: PrismaClient) => new PrismaOrganizationStaffRepository(prisma),
      inject: [PRISMA_CLIENT],
    },
    {
      provide: OrganizationStaffService,
      useFactory: (repo: PrismaOrganizationStaffRepository, email: EmailSender, baseUrl: string) =>
        new OrganizationStaffService(repo, email, baseUrl),
      inject: [PrismaOrganizationStaffRepository, EMAIL_SENDER, APP_BASE_URL],
    },
  ],
  exports: [TenancyService],
})
export class TenancyModule {}
