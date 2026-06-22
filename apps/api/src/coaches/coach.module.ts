import { Module } from "@nestjs/common";
import type { PrismaClient } from "@courtlink/database";
import { OBJECT_STORAGE, PRISMA_CLIENT } from "../auth/tokens.js";
import { CoachBookingService } from "./coach-booking.service.js";
import { CoachController } from "./coach.controller.js";
import { NotificationDispatcher } from "../notifications/notification.dispatcher.js";
import { CoachMarketService } from "./coach-market.service.js";
import { CoachRefundService } from "./coach-refund.service.js";
import { PrismaCoachRefundRepository } from "./prisma-coach-refund.repository.js";
import { CoachService } from "./coach.service.js";
import { PrismaCoachBookingRepository } from "./prisma-coach-booking.repository.js";
import { PrismaCoachMarketRepository } from "./prisma-coach-market.repository.js";
import { PrismaCoachRepository } from "./prisma-coach.repository.js";
import { CoachQueryService } from "./coach-query.service.js";
import { PrismaCoachQueryRepository } from "./prisma-coach-query.repository.js";
import type { ObjectStorage } from "../storage/object-storage.js";

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
      provide: PrismaCoachRefundRepository,
      useFactory: (prisma: PrismaClient) => new PrismaCoachRefundRepository(prisma),
      inject: [PRISMA_CLIENT],
    },
    {
      provide: CoachRefundService,
      useFactory: (repo: PrismaCoachRefundRepository) => new CoachRefundService(repo),
      inject: [PrismaCoachRefundRepository],
    },
    {
      provide: PrismaCoachQueryRepository,
      useFactory: (prisma: PrismaClient) => new PrismaCoachQueryRepository(prisma),
      inject: [PRISMA_CLIENT],
    },
    {
      provide: CoachQueryService,
      useFactory: (repo: PrismaCoachQueryRepository) => new CoachQueryService(repo),
      inject: [PrismaCoachQueryRepository],
    },
    {
      provide: CoachController,
      useFactory: (
        coaches: CoachService,
        market: CoachMarketService,
        bookings: CoachBookingService,
        bookingQuery: CoachQueryService,
        refunds: CoachRefundService,
        notifier: NotificationDispatcher,
        storage: ObjectStorage,
      ) => new CoachController(coaches, market, bookings, bookingQuery, refunds, notifier, storage),
      inject: [
        CoachService,
        CoachMarketService,
        CoachBookingService,
        CoachQueryService,
        CoachRefundService,
        NotificationDispatcher,
        OBJECT_STORAGE,
      ],
    },
  ],
  exports: [CoachService, CoachMarketService, CoachBookingService],
})
export class CoachModule {}
