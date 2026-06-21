import { Module } from "@nestjs/common";
import type { PrismaClient } from "@courtlink/database";
import { PRISMA_CLIENT } from "../auth/tokens.js";
import { TenancyModule } from "../tenancy/tenancy.module.js";
import { TenancyService } from "../tenancy/tenancy.service.js";
import { VenueModule } from "../venues/venue.module.js";
import { VenueService } from "../venues/venue.service.js";
import { BookingService } from "./booking.service.js";
import { CourtController } from "./court.controller.js";
import { CourtService } from "./court.service.js";
import { PrismaBookingRepository } from "./prisma-booking.repository.js";
import { PrismaCourtRepository } from "./prisma-court.repository.js";

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
      provide: CourtController,
      useFactory: (
        courts: CourtService,
        bookings: BookingService,
        tenancy: TenancyService,
        venues: VenueService,
      ) => new CourtController(courts, bookings, tenancy, venues),
      inject: [CourtService, BookingService, TenancyService, VenueService],
    },
  ],
  exports: [CourtService, BookingService, PrismaBookingRepository],
})
export class CourtModule {}
