import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { PUBLIC_ROUTE_KEY } from "../auth/session.guard.js";
import type { OperationsService } from "../operations/operations.service.js";
import { HealthController } from "./health.controller.js";

describe("HealthController", () => {
  it("reports process liveness without exposing internals", () => {
    const controller = new HealthController({} as OperationsService);

    expect(controller.liveness()).toEqual({ status: "live", service: "courtlink-api" });
  });

  it("delegates dependency readiness without exposing internals", async () => {
    const controller = new HealthController({
      readiness: async () => ({ status: "ready", service: "courtlink-api" }),
    } as OperationsService);

    await expect(controller.readiness()).resolves.toEqual({
      status: "ready",
      service: "courtlink-api",
    });
  });

  it("is public so unauthenticated health probes are not blocked by the session guard", () => {
    expect(Reflect.getMetadata(PUBLIC_ROUTE_KEY, HealthController)).toBe(true);
  });
});
