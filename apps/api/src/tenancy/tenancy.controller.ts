import { Body, Controller, Get, HttpCode, Param, Post, Req } from "@nestjs/common";
import { z } from "zod";
// biome-ignore lint/style/useImportType: OrganizationStaffService is injected by Nest at runtime.
import { OrganizationStaffService } from "./organization-staff.service.js";
// biome-ignore lint/style/useImportType: TenancyService is injected by Nest at runtime.
import { TenancyService } from "./tenancy.service.js";
import { type AuthenticatedRequest, getSessionUser } from "../auth/session.guard.js";

const createBusinessSchema = z.object({
  name: z.string().min(2).max(120),
  legalName: z.string().max(200).optional().nullable(),
});

const inviteSchema = z.object({
  email: z.string().email().max(254),
  role: z.enum(["MANAGER", "STAFF"]),
});

const acceptSchema = z.object({ token: z.string().min(10).max(256) });

@Controller({ path: "businesses", version: "1" })
export class TenancyController {
  constructor(
    private readonly tenancyService: TenancyService,
    private readonly staff: OrganizationStaffService,
  ) {}

  @Get("mine")
  async listMine(@Req() request: AuthenticatedRequest) {
    const user = getSessionUser(request);
    const memberships = await this.tenancyService.listMyMemberships(user.id);
    return memberships.map(({ businessId, role, status, business }) => ({
      businessId,
      role,
      status,
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

  @Post(":businessId/staff/invitations")
  @HttpCode(201)
  async invite(
    @Req() request: AuthenticatedRequest,
    @Param("businessId") businessId: string,
    @Body() body: unknown,
  ) {
    const actor = await this.requireManager(request, businessId);
    const input = inviteSchema.parse(body);
    await this.staff.inviteStaff({ businessId, email: input.email, role: input.role }, actor);
    return { status: "invited" };
  }

  @Get(":businessId/staff/invitations")
  async listInvitations(
    @Req() request: AuthenticatedRequest,
    @Param("businessId") businessId: string,
  ) {
    await this.requireManager(request, businessId);
    const invitations = await this.staff.listInvitations(businessId);
    return invitations.map(({ id, email, role, status, expiresAt }) => ({
      id,
      email,
      role,
      status,
      expiresAt,
    }));
  }

  @Post(":businessId/staff/invitations/:invitationId/revoke")
  @HttpCode(200)
  async revokeInvitation(
    @Req() request: AuthenticatedRequest,
    @Param("businessId") businessId: string,
    @Param("invitationId") invitationId: string,
  ) {
    const actor = await this.requireManager(request, businessId);
    await this.staff.revokeInvitation(businessId, invitationId, actor);
    return { status: "revoked" };
  }

  @Post("staff/invitations/accept")
  @HttpCode(200)
  async acceptInvitation(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getSessionUser(request);
    const input = acceptSchema.parse(body);
    return this.staff.acceptInvitation(input.token, { id: user.id, email: user.email });
  }

  @Get(":businessId/staff/members")
  async listMembers(@Req() request: AuthenticatedRequest, @Param("businessId") businessId: string) {
    await this.requireManager(request, businessId);
    const members = await this.staff.listMembers(businessId);
    return members.map(({ userId, email, role, status }) => ({ userId, email, role, status }));
  }

  @Post(":businessId/staff/members/:userId/suspend")
  @HttpCode(200)
  async suspendMember(
    @Req() request: AuthenticatedRequest,
    @Param("businessId") businessId: string,
    @Param("userId") userId: string,
  ) {
    const actor = await this.requireManager(request, businessId);
    await this.staff.suspendMembership(businessId, userId, actor);
    return { status: "suspended" };
  }

  @Post(":businessId/staff/members/:userId/reinstate")
  @HttpCode(200)
  async reinstateMember(
    @Req() request: AuthenticatedRequest,
    @Param("businessId") businessId: string,
    @Param("userId") userId: string,
  ) {
    const actor = await this.requireManager(request, businessId);
    await this.staff.reinstateMembership(businessId, userId, actor);
    return { status: "reinstated" };
  }

  @Post(":businessId/staff/members/:userId/remove")
  @HttpCode(200)
  async removeMember(
    @Req() request: AuthenticatedRequest,
    @Param("businessId") businessId: string,
    @Param("userId") userId: string,
  ) {
    const actor = await this.requireManager(request, businessId);
    await this.staff.removeMembership(businessId, userId, actor);
    return { status: "removed" };
  }

  @Get(":businessId/audit")
  async listAudit(@Req() request: AuthenticatedRequest, @Param("businessId") businessId: string) {
    await this.requireManager(request, businessId);
    return this.staff.listAuditEvents(businessId);
  }

  private async requireManager(
    request: AuthenticatedRequest,
    businessId: string,
  ): Promise<{ id: string; role: "OWNER" | "MANAGER" | "STAFF" }> {
    const user = getSessionUser(request);
    const membership = await this.tenancyService.assertRole(user.id, businessId, [
      "OWNER",
      "MANAGER",
    ]);
    return { id: user.id, role: membership.role };
  }
}
