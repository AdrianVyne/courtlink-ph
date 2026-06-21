import { Body, Controller, Get, HttpCode, Post, Req } from "@nestjs/common";
import { z } from "zod";
// biome-ignore lint/style/useImportType: TenancyService is injected by Nest at runtime.
import { TenancyService } from "./tenancy.service.js";
import { type AuthenticatedRequest, getSessionUser } from "../auth/session.guard.js";

const createBusinessSchema = z.object({
  name: z.string().min(2).max(120),
  legalName: z.string().max(200).optional().nullable(),
});

@Controller({ path: "businesses", version: "1" })
export class TenancyController {
  constructor(private readonly tenancyService: TenancyService) {}

  @Get("mine")
  async listMine(@Req() request: AuthenticatedRequest) {
    const user = getSessionUser(request);
    const memberships = await this.tenancyService.listMyMemberships(user.id);
    return memberships.map(({ businessId, role, business }) => ({
      businessId,
      role,
      business,
    }));
  }

  @Post()
  @HttpCode(201)
  async create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getSessionUser(request);
    const input = createBusinessSchema.parse(body);
    return this.tenancyService.createBusiness(input, user.id);
  }
}
