import { Module } from "@nestjs/common";
import type { PrismaClient } from "@courtlink/database";
import { PRISMA_CLIENT } from "../auth/tokens.js";
import { CoachBookingService } from "./coach-booking.service.js";
import { CoachController } from "./coach.controller.js";
import { NotificationDispatcher } from "../notifications/notification.dispatcher.js";
import { CoachMarketService } from "./coach-market.service.js";
import { CoachService } from "./coach.service.js";
import { PrismaCoachBookingRepository } from "./prisma-coach-booking.repository.js";
import { PrismaCoachMarketRepository } from "./prisma-coach-market.repository.js";
import { PrismaCoachRepository } from "./prisma-coach.repository.js";

@Module({
  controllers: [CoachController],
  providers: [
    {
      provide: PrismaCoachRepository,
      useFactory: (prisma: PrismaClient) => new PrismaCoachRepository(prisma),
      inject: [PRISMA_CLIENT],
    },
    {
      provide: PrismaCoachMarketRepository,
      useFactory: (prisma: PrismaClient) => new PrismaCoachMarketRepository(prisma),
      inject: [PRISMA_CLIENT],
    },
    {
      provide: PrismaCoachBookingRepository,
      useFactory: (prisma: PrismaClient) => new PrismaCoachBookingRepository(prisma),
      inject: [PRISMA_CLIENT],
    },
    {
      provide: CoachService,
      useFactory: (repo: PrismaCoachRepository) => new CoachService(repo),
      inject: [PrismaCoachRepository],
    },
    {
      provide: CoachMarketService,
      useFactory: (repo: PrismaCoachMarketRepository) => new CoachMarketService(repo),
      inject: [PrismaCoachMarketRepository],
    },
    {
      provide: CoachBookingService,
      useFactory: (repo: PrismaCoachBookingRepository) => new CoachBookingService(repo),
      inject: [PrismaCoachBookingRepository],
    },
    {
      provide: CoachController,
      useFactory: (
        coaches: CoachService,
        market: CoachMarketService,
        bookings: CoachBookingService,
        notifier: NotificationDispatcher,
      ) => new CoachController(coaches, market, bookings, notifier),
      inject: [CoachService, CoachMarketService, CoachBookingService, NotificationDispatcher],
    },
  ],
  exports: [CoachService, CoachMarketService, CoachBookingService],
})
export class CoachModule {}
