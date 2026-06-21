import { Module } from "@nestjs/common";
import type { PrismaClient } from "@courtlink/database";
import type { ObjectStorage } from "../storage/object-storage.js";
import { OBJECT_STORAGE, PRISMA_CLIENT } from "../auth/tokens.js";
import { NotificationDispatcher } from "../notifications/notification.dispatcher.js";
import { TenancyModule } from "../tenancy/tenancy.module.js";
import { TenancyService } from "../tenancy/tenancy.service.js";
import { VenueModule } from "../venues/venue.module.js";
import { VenueService } from "../venues/venue.service.js";
import { BookingService } from "./booking.service.js";
import { CourtController } from "./court.controller.js";
import { CourtService } from "./court.service.js";
import { BookingQueryService } from "./booking-query.service.js";
import { PrismaBookingQueryRepository } from "./prisma-booking-query.repository.js";
import { PrismaBookingRepository } from "./prisma-booking.repository.js";
import { PrismaCourtRepository } from "./prisma-court.repository.js";
import { PrismaRefundRepository } from "./prisma-refund.repository.js";
import { RefundService } from "./refund.service.js";

@Module({
  imports: [TenancyModule, VenueModule],
  controllers: [CourtController],
  providers: [
    {
      provide: PrismaCourtRepository,
      useFactory: (prisma: PrismaClient) => new PrismaCourtRepository(prisma),
      inject: [PRISMA_CLIENT],
    },
    {
      provide: PrismaBookingRepository,
      useFactory: (prisma: PrismaClient) => new PrismaBookingRepository(prisma),
      inject: [PRISMA_CLIENT],
    },
    {
      provide: PrismaBookingQueryRepository,
      useFactory: (prisma: PrismaClient) => new PrismaBookingQueryRepository(prisma),
      inject: [PRISMA_CLIENT],
    },
    {
      provide: BookingQueryService,
      useFactory: (repo: PrismaBookingQueryRepository) => new BookingQueryService(repo),
      inject: [PrismaBookingQueryRepository],
    },
    {
      provide: PrismaRefundRepository,
      useFactory: (prisma: PrismaClient) => new PrismaRefundRepository(prisma),
      inject: [PRISMA_CLIENT],
    },
    {
      provide: CourtService,
      useFactory: (repo: PrismaCourtRepository) => new CourtService(repo),
      inject: [PrismaCourtRepository],
    },
    {
      provide: BookingService,
      useFactory: (bookingRepo: PrismaBookingRepository, courtRepo: PrismaCourtRepository) =>
        new BookingService(bookingRepo, courtRepo),
      inject: [PrismaBookingRepository, PrismaCourtRepository],
    },
    {
      provide: RefundService,
      useFactory: (repo: PrismaRefundRepository) => new RefundService(repo),
      inject: [PrismaRefundRepository],
    },
    {
      provide: CourtController,
      useFactory: (
        courts: CourtService,
        bookings: BookingService,
        bookingQuery: BookingQueryService,
        refunds: RefundService,
        tenancy: TenancyService,
        venues: VenueService,
        storage: ObjectStorage,
        notifier: NotificationDispatcher,
      ) =>
        new CourtController(
          courts,
          bookings,
          bookingQuery,
          refunds,
          tenancy,
          venues,
          storage,
          notifier,
        ),
      inject: [
        CourtService,
        BookingService,
        BookingQueryService,
        RefundService,
        TenancyService,
        VenueService,
        OBJECT_STORAGE,
        NotificationDispatcher,
      ],
    },
  ],
  exports: [CourtService, BookingService, PrismaBookingRepository],
})
export class CourtModule {}
