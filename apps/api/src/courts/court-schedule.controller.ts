import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Req } from "@nestjs/common";
import { z } from "zod";
import { type AuthenticatedRequest, getSessionUser } from "../auth/session.guard.js";
// biome-ignore lint/style/useImportType: TenancyService is injected by Nest at runtime.
import { TenancyService } from "../tenancy/tenancy.service.js";
// biome-ignore lint/style/useImportType: VenueService is injected by Nest at runtime.
import { VenueService } from "../venues/venue.service.js";
// biome-ignore lint/style/useImportType: CourtScheduleService is injected by Nest at runtime.
import { CourtScheduleService } from "./court-schedule.service.js";
// biome-ignore lint/style/useImportType: CourtService is injected by Nest at runtime.
import { CourtService } from "./court.service.js";
import { ScheduleManagementError } from "./court-schedule.service.js";

const hoursSchema = z.object({
  windows: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        opensMinute: z.number().int().min(0).max(1_439),
        closesMinute: z.number().int().min(1).max(1_440),
      }),
    )
    .max(50),
});

const closureSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  reason: z.string().max(500).optional().nullable(),
});

@Controller({ path: "courts", version: "1" })
export class CourtScheduleController {
  constructor(
    private readonly schedules: CourtScheduleService,
    private readonly courts: CourtService,
    private readonly tenancy: TenancyService,
    private readonly venues: VenueService,
  ) {}

  @Get(":id/schedule")
  async schedule(@Req() request: AuthenticatedRequest, @Param("id") courtId: string) {
    await this.authorize(request, courtId);
    return this.schedules.getSchedule(courtId);
  }

  @Put(":id/operating-hours")
  async replaceHours(
    @Req() request: AuthenticatedRequest,
    @Param("id") courtId: string,
    @Body() body: unknown,
  ) {
    await this.authorize(request, courtId);
    const input = hoursSchema.parse(body);
    return this.schedules.replaceOperatingHours(courtId, input.windows);
  }

  @Post(":id/closures")
  @HttpCode(201)
  async createClosure(
    @Req() request: AuthenticatedRequest,
    @Param("id") courtId: string,
    @Body() body: unknown,
  ) {
    await this.authorize(request, courtId);
    const input = closureSchema.parse(body);
    return this.schedules.createClosure({
      courtId,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      reason: input.reason ?? null,
    });
  }

  @Delete(":id/closures/:closureId")
  async deleteClosure(
    @Req() request: AuthenticatedRequest,
    @Param("id") courtId: string,
    @Param("closureId") closureId: string,
  ) {
    await this.authorize(request, courtId);
    await this.schedules.deleteClosure(courtId, closureId);
    return { deleted: true };
  }

  private async authorize(request: AuthenticatedRequest, courtId: string): Promise<void> {
    const user = getSessionUser(request);
    const court = await this.courts.findCourtById(courtId);
    if (!court) throw new ScheduleManagementError("COURT_NOT_FOUND", "Court not found");
    const venue = await this.venues.findVenueById(court.venueId);
    if (!venue) throw new ScheduleManagementError("VENUE_NOT_FOUND", "Venue not found");
    await this.tenancy.assertRole(user.id, venue.businessId, ["OWNER", "MANAGER"]);
  }
}
