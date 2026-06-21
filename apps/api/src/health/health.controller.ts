import { Controller, Get } from "@nestjs/common";

export interface ReadinessResponse {
  status: "ready";
  service: "courtlink-api";
}

@Controller("health")
export class HealthController {
  @Get("ready")
  readiness(): ReadinessResponse {
    return { status: "ready", service: "courtlink-api" };
  }
}
