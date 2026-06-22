import { Controller, Get } from "@nestjs/common";
import { Public } from "../auth/session.guard.js";
// biome-ignore lint/style/useImportType: OperationsService is a Nest runtime injection token.
import { OperationsService } from "../operations/operations.service.js";

export interface ReadinessResponse {
  status: "ready";
  service: "courtlink-api";
}

export interface LivenessResponse {
  status: "live";
  service: "courtlink-api";
}

@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly operations: OperationsService) {}

  @Get("live")
  liveness(): LivenessResponse {
    return { status: "live", service: "courtlink-api" };
  }

  @Get("ready")
  readiness(): Promise<ReadinessResponse> {
    return this.operations.readiness();
  }
}
