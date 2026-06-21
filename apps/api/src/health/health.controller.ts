import { Controller, Get } from "@nestjs/common";
import { Public } from "../auth/session.guard.js";

export interface ReadinessResponse {
  status: "ready";
  service: "courtlink-api";
}

@Public()
@Controller("health")
export class HealthController {
  @Get("ready")
  readiness(): ReadinessResponse {
    return { status: "ready", service: "courtlink-api" };
  }
}
