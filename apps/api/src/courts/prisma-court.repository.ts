import type { PrismaClient } from "@courtlink/database";
import type { ClosureWindow, OperatingWindow } from "./availability-policy.js";
import { ScheduleError } from "./availability-policy.js";
import {
  type BlockingBookingInterval,
  type ClosureInput,
  type CourtRepository,
  type CourtSummary,
  type CreateCourtInput,
  type OperatingWindowInput,
  type PricingRule,
  toCourtSummary,
  toPricingRule,
} from "./court.service.js";

export class PrismaCourtRepository implements CourtRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createCourt(input: CreateCourtInput): Promise<CourtSummary> {
    const court = await this.prisma.court.create({
      data: {
        venueId: input.venueId,
        name: input.name,
        description: input.description ?? null,
        indoor: input.indoor ?? false,
        slotIncrementMin: input.slotIncrementMin ?? 30,
        minimumDurationMin: input.minimumDurationMin ?? 60,
        maximumDurationMin: input.maximumDurationMin ?? 240,
      },
    });
    return toCourtSummary(court);
  }

  async listCourtsForVenue(venueId: string): Promise<CourtSummary[]> {
    const courts = await this.prisma.court.findMany({
      where: { venueId },
      orderBy: { name: "asc" },
    });
    return courts.map(toCourtSummary);
  }

  async findCourtById(id: string): Promise<CourtSummary | null> {
    const court = await this.prisma.court.findUnique({ where: { id } });
    return court ? toCourtSummary(court) : null;
  }

  async listPricingRules(courtId: string): Promise<PricingRule[]> {
    const rules = await this.prisma.courtPricingRule.findMany({ where: { courtId } });
    return rules.map(toPricingRule);
  }

  async getSchedule(courtId: string): Promise<{
    operatingHours: OperatingWindow[];
    closures: ClosureWindow[];
  }> {
    const [operatingHours, closures] = await Promise.all([
      this.prisma.courtOperatingHour.findMany({
        where: { courtId },
        orderBy: [{ dayOfWeek: "asc" }, { opensMinute: "asc" }],
      }),
      this.prisma.courtClosure.findMany({
        where: { courtId },
        orderBy: { startsAt: "asc" },
      }),
    ]);
    return {
      operatingHours: operatingHours.map((window) => ({ ...window })),
      closures: closures.map((closure) => ({ ...closure })),
    };
  }

  async replaceOperatingHours(
    courtId: string,
    windows: OperatingWindowInput[],
  ): Promise<OperatingWindow[]> {
    return this.prisma.$transaction(async (tx) => {
      await tx.court.findUniqueOrThrow({ where: { id: courtId } });
      await tx.courtOperatingHour.deleteMany({ where: { courtId } });
      if (windows.length > 0) {
        await tx.courtOperatingHour.createMany({
          data: windows.map((window) => ({ courtId, ...window })),
        });
      }
      return tx.courtOperatingHour.findMany({
        where: { courtId },
        orderBy: [{ dayOfWeek: "asc" }, { opensMinute: "asc" }],
      });
    });
  }

  async createClosure(input: ClosureInput): Promise<ClosureWindow> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${input.courtId}, 0)) IS NULL AS "locked"
      `;
      await tx.court.findUniqueOrThrow({ where: { id: input.courtId } });
      const conflicting = await tx.courtBooking.findFirst({
        where: {
          courtId: input.courtId,
          status: { in: ["HELD", "PROOF_SUBMITTED", "CONFIRMED", "REFUND_REQUESTED"] },
          startsAt: { lt: input.endsAt },
          endsAt: { gt: input.startsAt },
        },
        select: { id: true },
      });
      if (conflicting) {
        throw new ScheduleError(
          "CLOSURE_BOOKINGS_EXIST",
          "Cancel or resolve overlapping bookings before creating this closure",
        );
      }
      return tx.courtClosure.create({
        data: {
          courtId: input.courtId,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          reason: input.reason ?? null,
        },
      });
    });
  }

  async deleteClosure(courtId: string, closureId: string): Promise<boolean> {
    const result = await this.prisma.courtClosure.deleteMany({ where: { id: closureId, courtId } });
    return result.count === 1;
  }

  async listBlockingBookings(
    courtId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<BlockingBookingInterval[]> {
    return this.prisma.courtBooking.findMany({
      where: {
        courtId,
        status: { in: ["HELD", "PROOF_SUBMITTED", "CONFIRMED", "REFUND_REQUESTED"] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { id: true, startsAt: true, endsAt: true },
      orderBy: { startsAt: "asc" },
    });
  }
}
