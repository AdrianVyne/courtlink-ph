import { Controller, ForbiddenException, Get, Req } from "@nestjs/common";
import { type AuthenticatedRequest, getSessionUser } from "../auth/session.guard.js";
// biome-ignore lint/style/useImportType: OperationsService is injected by Nest at runtime.
import { OperationsService } from "./operations.service.js";

const LEVEL_VALUE = { ok: 0, warning: 1, critical: 2 } as const;

function requireSuperAdmin(request: AuthenticatedRequest): void {
  const user = getSessionUser(request);
  if (!user.roles.includes("SUPER_ADMIN")) {
    throw new ForbiddenException({ code: "SUPER_ADMIN_REQUIRED" });
  }
}

@Controller({ path: "operations", version: "1" })
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Get("status")
  async status(@Req() request: AuthenticatedRequest) {
    requireSuperAdmin(request);
    return this.operations.status();
  }

  @Get("metrics")
  async metrics(@Req() request: AuthenticatedRequest): Promise<Record<string, number>> {
    requireSuperAdmin(request);
    const status = await this.operations.status();
    return {
      courtlink_operational_level: LEVEL_VALUE[status.overall],
      courtlink_process_heap_usage_ratio: status.metrics.processHeapRatio,
      courtlink_event_loop_delay_milliseconds: status.metrics.eventLoopDelayMs,
      courtlink_database_usage_ratio: status.metrics.databaseRatio,
      courtlink_redis_usage_ratio: status.metrics.redisRatio ?? -1,
      courtlink_queue_failed_jobs: status.metrics.failedJobs,
      courtlink_uptime_seconds: status.process.uptimeSeconds,
    };
  }
}
