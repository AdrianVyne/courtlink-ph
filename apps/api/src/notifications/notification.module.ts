import { Global, Module } from "@nestjs/common";
// biome-ignore lint/style/useImportType: PrismaClient is used as a Nest provider token.
import { PrismaClient } from "@courtlink/database";
import { EMAIL_SENDER, PRISMA_CLIENT } from "../auth/tokens.js";
import { LoggingEmailSender } from "./logging-email-sender.js";
import { NotificationController } from "./notification.controller.js";
import { NotificationDispatcher } from "./notification.dispatcher.js";
import { NotificationService } from "./notification.service.js";
import { PrismaNotificationRepository } from "./prisma-notification.repository.js";
import { PrismaUserDirectory } from "./prisma-user-directory.js";

@Global()
@Module({
  controllers: [NotificationController],
  providers: [
    {
      provide: EMAIL_SENDER,
      useFactory: () => new LoggingEmailSender(),
    },
    {
      provide: PrismaNotificationRepository,
      useFactory: (prisma: PrismaClient) => new PrismaNotificationRepository(prisma),
      inject: [PRISMA_CLIENT],
    },
    {
      provide: PrismaUserDirectory,
      useFactory: (prisma: PrismaClient) => new PrismaUserDirectory(prisma),
      inject: [PRISMA_CLIENT],
    },
    {
      provide: NotificationService,
      useFactory: (repo: PrismaNotificationRepository) => new NotificationService(repo),
      inject: [PrismaNotificationRepository],
    },
    {
      provide: NotificationDispatcher,
      useFactory: (
        service: NotificationService,
        email: LoggingEmailSender,
        directory: PrismaUserDirectory,
      ) => new NotificationDispatcher(service, email, directory),
      inject: [NotificationService, EMAIL_SENDER, PrismaUserDirectory],
    },
  ],
  exports: [NotificationService, NotificationDispatcher, EMAIL_SENDER],
})
export class NotificationModule {}
