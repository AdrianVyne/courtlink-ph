import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { z } from "zod";
import { type AuthenticatedRequest, getSessionUser } from "../auth/session.guard.js";
// biome-ignore lint/style/useImportType: ModerationService is injected at runtime by Nest.
import { ModerationService } from "./moderation.service.js";

const subjectEnum = z.enum(["VENUE", "COACH", "USER", "REVIEW"]);

const reportSchema = z.object({
  subjectType: subjectEnum,
  subjectId: z.string().min(1).max(200),
  reason: z.string().min(4).max(2000),
});

const resolveSchema = z.object({
  caseId: z.string().uuid(),
  status: z.enum(["RESOLVED", "DISMISSED"]),
  resolution: z.string().min(1).max(2000),
});

const suspendSchema = z.object({
  subjectType: z.enum(["VENUE", "COACH", "USER"]),
  subjectId: z.string().uuid(),
});

const listSchema = z.object({
  status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"]).optional(),
});

function requireSuperAdmin(request: AuthenticatedRequest): { id: string } {
  const user = getSessionUser(request);
  if (!user.roles.includes("SUPER_ADMIN")) {
    throw new ForbiddenException({ code: "SUPER_ADMIN_REQUIRED" });
  }
  return user;
}

@Controller({ path: "moderation", version: "1" })
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Post("reports")
  @HttpCode(201)
  async report(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getSessionUser(request);
    const input = reportSchema.parse(body);
    return this.moderation.report({ reporterId: user.id, ...input });
  }

  @Get("cases")
  async cases(@Req() request: AuthenticatedRequest, @Query() query: Record<string, string>) {
    requireSuperAdmin(request);
    const { status } = listSchema.parse(query);
    return status ? this.moderation.listCasesByStatus(status) : this.moderation.listOpenCases();
  }

  @Post("cases/resolve")
  @HttpCode(200)
  async resolve(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const admin = requireSuperAdmin(request);
    const input = resolveSchema.parse(body);
    return this.moderation.resolveCase({ actorId: admin.id, ...input });
  }

  @Post("subjects/suspend")
  @HttpCode(200)
  async suspend(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const admin = requireSuperAdmin(request);
    const input = suspendSchema.parse(body);
    await this.moderation.setSuspension({ actorId: admin.id, ...input, suspended: true });
    return { suspended: true };
  }

  @Post("subjects/reinstate")
  @HttpCode(200)
  async reinstate(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const admin = requireSuperAdmin(request);
    const input = suspendSchema.parse(body);
    await this.moderation.setSuspension({ actorId: admin.id, ...input, suspended: false });
    return { suspended: false };
  }
}
