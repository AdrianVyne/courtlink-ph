import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { z } from "zod";
import { type AuthenticatedRequest, Public, getSessionUser } from "../auth/session.guard.js";
// biome-ignore lint/style/useImportType: TenancyService is injected at runtime.
import { TenancyService } from "../tenancy/tenancy.service.js";
// biome-ignore lint/style/useImportType: VenueService is injected at runtime.
import { VenueService } from "../venues/venue.service.js";
// biome-ignore lint/style/useImportType: PromotionService is injected at runtime.
import { PromotionService } from "./promotion.service.js";

const createSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(2000).optional().nullable(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  discountType: z.enum(["PERCENT", "FIXED"]),
  discountValue: z.number().positive().max(1_000_000),
});

@Controller({ path: "promotions", version: "1" })
export class PromotionController {
  constructor(
    private readonly promotions: PromotionService,
    private readonly tenancy: TenancyService,
    private readonly venues: VenueService,
  ) {}

  @Public()
  @Get("venues/:venueId/active")
  async active(@Param("venueId") venueId: string) {
    return this.promotions.listActive(venueId);
  }

  @Get("venues/:venueId")
  async manageList(@Req() request: AuthenticatedRequest, @Param("venueId") venueId: string) {
    const user = getSessionUser(request);
    await this.requireVenueRole(user.id, venueId);
    return this.promotions.listForVenue(venueId);
  }

  @Post("venues/:venueId")
  @HttpCode(201)
  async create(
    @Req() request: AuthenticatedRequest,
    @Param("venueId") venueId: string,
    @Body() body: unknown,
  ) {
    const user = getSessionUser(request);
    await this.requireVenueRole(user.id, venueId);
    const input = createSchema.parse(body);
    return this.promotions.createPromotion({
      venueId,
      title: input.title,
      description: input.description ?? null,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      discountType: input.discountType,
      discountValue: input.discountValue,
    });
  }

  @Post(":id/deactivate")
  @HttpCode(200)
  async deactivate(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    const user = getSessionUser(request);
    const venueId = await this.promotions.venueOf(id);
    if (!venueId) throw new BadRequestException({ code: "PROMOTION_NOT_FOUND" });
    await this.requireVenueRole(user.id, venueId);
    return this.promotions.deactivate(id);
  }

  private async requireVenueRole(userId: string, venueId: string): Promise<void> {
    const venue = await this.venues.findVenueById(venueId);
    if (!venue) throw new BadRequestException({ code: "VENUE_NOT_FOUND" });
    await this.tenancy.assertRole(userId, venue.businessId, ["OWNER", "MANAGER"]);
  }
}
