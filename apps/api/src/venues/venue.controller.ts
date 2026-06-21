import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { z } from "zod";
import { type AuthenticatedRequest, Public, getSessionUser } from "../auth/session.guard.js";
// biome-ignore lint/style/useImportType: TenancyService is injected by Nest at runtime.
import { TenancyService } from "../tenancy/tenancy.service.js";
// biome-ignore lint/style/useImportType: VenueService is injected by Nest at runtime.
import { VenueService } from "./venue.service.js";

const slugSchema = z
  .string()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, digits and dashes");

const createVenueSchema = z.object({
  businessId: z.string().uuid(),
  name: z.string().min(2).max(120),
  slug: slugSchema,
  description: z.string().max(2000).optional().nullable(),
  regionCode: z.string().min(2).max(10),
  provinceCode: z.string().max(10).optional().nullable(),
  cityMunicipality: z.string().min(2).max(120),
  barangay: z.string().max(120).optional().nullable(),
  streetAddress: z.string().min(2).max(200),
});

const listVenuesSchema = z.object({
  regionCode: z.string().min(2).max(10).optional(),
  cityMunicipality: z.string().max(120).optional(),
  query: z.string().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

@Controller({ path: "venues", version: "1" })
export class VenueController {
  constructor(
    private readonly venueService: VenueService,
    private readonly tenancyService: TenancyService,
  ) {}

  @Public()
  @Get()
  async listPublic(@Query() query: Record<string, string>) {
    const filters = listVenuesSchema.parse(query);
    return this.venueService.listPublicVenues(filters);
  }

  @Public()
  @Get("by-slug/:slug")
  async getBySlug(@Param("slug") slug: string) {
    const venue = await this.venueService.findVenueBySlug(slug);
    if (!venue || venue.status !== "APPROVED") {
      throw new BadRequestException({ code: "VENUE_NOT_FOUND" });
    }
    return venue;
  }

  @Get("mine")
  async listMine(@Req() request: AuthenticatedRequest) {
    const user = getSessionUser(request);
    const memberships = await this.tenancyService.listMyMemberships(user.id);
    const results = await Promise.all(
      memberships.map(async (membership) => {
        const venues = await this.venueService.listVenuesForBusiness(membership.businessId);
        return venues.map((venue) => ({ membershipRole: membership.role, venue }));
      }),
    );
    return results.flat();
  }

  @Post()
  @HttpCode(201)
  async create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getSessionUser(request);
    const input = createVenueSchema.parse(body);
    await this.tenancyService.assertRole(user.id, input.businessId, ["OWNER", "MANAGER"]);
    return this.venueService.createVenue(input);
  }

  @Post(":id/submit")
  @HttpCode(200)
  async submit(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    const user = getSessionUser(request);
    const venue = await this.requireOwnedVenue(user.id, id);
    return this.venueService.submitForReview(venue.id);
  }

  @Post("admin/:id/approve")
  @HttpCode(200)
  async approve(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    requireSuperAdmin(request);
    return this.venueService.approveVenue(id);
  }

  @Post("admin/:id/reject")
  @HttpCode(200)
  async reject(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    requireSuperAdmin(request);
    return this.venueService.rejectVenue(id);
  }

  private async requireOwnedVenue(userId: string, venueId: string) {
    const venue = await this.venueService.findVenueById(venueId);
    if (!venue) throw new BadRequestException({ code: "VENUE_NOT_FOUND" });
    await this.tenancyService.assertRole(userId, venue.businessId, ["OWNER", "MANAGER"]);
    return venue;
  }
}

function requireSuperAdmin(request: AuthenticatedRequest): void {
  const user = getSessionUser(request);
  if (!user.roles.includes("SUPER_ADMIN")) {
    throw new ForbiddenException({ code: "SUPER_ADMIN_REQUIRED" });
  }
}
