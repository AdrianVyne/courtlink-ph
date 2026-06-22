import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
} from "@nestjs/common";
import { z } from "zod";
import { type AuthenticatedRequest, Public, getSessionUser } from "../auth/session.guard.js";
// biome-ignore lint/style/useImportType: TenancyService is injected by Nest at runtime.
import { TenancyService } from "../tenancy/tenancy.service.js";
// biome-ignore lint/style/useImportType: VenueService is injected by Nest at runtime.
import { VenueService } from "./venue.service.js";
// biome-ignore lint/style/useImportType: DiscoveryService is injected by Nest at runtime.
import { DiscoveryService } from "./discovery.service.js";
// biome-ignore lint/style/useImportType: AmenityService is injected by Nest at runtime.
import { AmenityService } from "../amenities/amenity.service.js";

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

const csvToList = (value: string | string[] | undefined): string[] | undefined => {
  if (value === undefined) return undefined;
  const list = Array.isArray(value) ? value : value.split(",");
  const cleaned = list.map((item) => item.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned : undefined;
};

const discoverySchema = z.object({
  regionCode: z.string().min(2).max(10).optional(),
  provinceCode: z.string().max(10).optional(),
  cityMunicipality: z.string().max(120).optional(),
  query: z.string().max(120).optional(),
  amenities: z.union([z.string().max(400), z.array(z.string().max(60)).max(40)]).optional(),
  minPrice: z.coerce.number().min(0).max(1_000_000).optional(),
  maxPrice: z.coerce.number().min(0).max(1_000_000).optional(),
  availableDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  durationMin: z.coerce.number().int().min(30).max(720).optional(),
  earliestMinute: z.coerce.number().int().min(0).max(1440).optional(),
  latestMinute: z.coerce.number().int().min(0).max(1440).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const amenitiesBodySchema = z.object({
  amenities: z.array(z.string().min(1).max(60)).max(40),
});

@Controller({ path: "venues", version: "1" })
export class VenueController {
  constructor(
    private readonly venueService: VenueService,
    private readonly tenancyService: TenancyService,
    private readonly discovery: DiscoveryService,
    private readonly amenities: AmenityService,
  ) {}

  @Public()
  @Get()
  async listPublic(@Query() query: Record<string, string>) {
    const input = discoverySchema.parse(query);
    const results = await this.discovery.search({
      regionCode: input.regionCode,
      provinceCode: input.provinceCode,
      cityMunicipality: input.cityMunicipality,
      query: input.query,
      amenities: csvToList(input.amenities),
      minPrice: input.minPrice,
      maxPrice: input.maxPrice,
      availableDate: input.availableDate,
      durationMin: input.durationMin,
      earliestMinute: input.earliestMinute,
      latestMinute: input.latestMinute,
      limit: input.limit,
    });
    return results.map((result) => ({
      ...result.venue,
      amenities: result.amenities,
      fromPrice: result.fromPrice,
      availableCourtCount: result.availableCourtCount,
    }));
  }

  @Public()
  @Get("by-slug/:slug")
  async getBySlug(@Param("slug") slug: string) {
    const venue = await this.venueService.findVenueBySlug(slug);
    if (venue?.status !== "APPROVED") {
      throw new BadRequestException({ code: "VENUE_NOT_FOUND" });
    }
    const amenities = await this.amenities.listVenueAmenities(venue.id);
    return { ...venue, amenities: amenities.map((entry) => entry.key) };
  }

  @Get(":id/amenities")
  async getAmenities(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    const user = getSessionUser(request);
    const venue = await this.requireOwnedVenue(user.id, id);
    const list = await this.amenities.listVenueAmenities(venue.id);
    return { amenities: list.map((entry) => entry.key) };
  }

  @Put(":id/amenities")
  @HttpCode(200)
  async setAmenities(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const user = getSessionUser(request);
    const venue = await this.requireOwnedVenue(user.id, id);
    const input = amenitiesBodySchema.parse(body);
    await this.amenities.setVenueAmenities(venue.id, input.amenities);
    const updated = await this.amenities.listVenueAmenities(venue.id);
    return { amenities: updated.map((entry) => entry.key) };
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

  @Get("admin/pending")
  async listPending(@Req() request: AuthenticatedRequest) {
    requireSuperAdmin(request);
    return this.venueService.listPendingVenues();
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
