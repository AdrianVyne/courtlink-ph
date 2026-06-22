import { Module } from "@nestjs/common";
import { AvailabilityController } from "./availability.controller.js";
import { AvailabilityService } from "./availability.service.js";
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
import { CourtScheduleController } from "./court-schedule.controller.js";
import { CourtScheduleService } from "./court-schedule.service.js";
import { CourtService } from "./court.service.js";
import { BookingQueryService } from "./booking-query.service.js";
import { PrismaBookingQueryRepository } from "./prisma-booking-query.repository.js";
import { PrismaBookingRepository } from "./prisma-booking.repository.js";
import { PrismaCourtRepository } from "./prisma-court.repository.js";
import { PrismaRefundRepository } from "./prisma-refund.repository.js";
import { RefundService } from "./refund.service.js";

@Module({
  imports: [TenancyModule, VenueModule],
  controllers: [CourtController, CourtScheduleController, AvailabilityController],
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
      provide: CourtScheduleService,
      useFactory: (repo: PrismaCourtRepository) => new CourtScheduleService(repo),
      inject: [PrismaCourtRepository],
    },
    {
      provide: AvailabilityService,
      useFactory: (repo: PrismaCourtRepository) => new AvailabilityService(repo),
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
    {
      provide: CourtScheduleController,
      useFactory: (
        schedules: CourtScheduleService,
        courts: CourtService,
        tenancy: TenancyService,
        venues: VenueService,
      ) => new CourtScheduleController(schedules, courts, tenancy, venues),
      inject: [CourtScheduleService, CourtService, TenancyService, VenueService],
    },
    {
      provide: AvailabilityController,
      useFactory: (availability: AvailabilityService) => new AvailabilityController(availability),
      inject: [AvailabilityService],
    },
  ],
  exports: [CourtService, BookingService, PrismaBookingRepository],
})
export class CourtModule {}
