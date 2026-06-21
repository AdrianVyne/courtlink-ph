import { Controller, Get, HttpCode, Param, Post, Req } from "@nestjs/common";
import { type AuthenticatedRequest, getSessionUser } from "../auth/session.guard.js";
// biome-ignore lint/style/useImportType: NotificationService is injected at runtime by Nest.
import { NotificationService } from "./notification.service.js";

@Controller({ path: "notifications", version: "1" })
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    const user = getSessionUser(request);
    return this.notifications.listForUser(user.id);
  }

  @Get("unread-count")
  async unread(@Req() request: AuthenticatedRequest) {
    const user = getSessionUser(request);
    return { count: await this.notifications.countUnread(user.id) };
  }

  @Post(":id/read")
  @HttpCode(200)
  async read(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    const user = getSessionUser(request);
    return { updated: await this.notifications.markRead(user.id, id) };
  }

  @Post("read-all")
  @HttpCode(200)
  async readAll(@Req() request: AuthenticatedRequest) {
    const user = getSessionUser(request);
    return { updated: await this.notifications.markAllRead(user.id) };
  }
}
