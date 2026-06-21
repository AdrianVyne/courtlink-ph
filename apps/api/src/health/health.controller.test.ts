import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import { PUBLIC_ROUTE_KEY } from "../auth/session.guard.js";
import { HealthController } from "./health.controller.js";

describe("HealthController", () => {
  it("reports API readiness without exposing internals", async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [HealthController] }).compile();
    const controller = moduleRef.get(HealthController);

    expect(controller.readiness()).toEqual({ status: "ready", service: "courtlink-api" });
  });

  it("is public so unauthenticated health probes are not blocked by the session guard", () => {
    expect(Reflect.getMetadata(PUBLIC_ROUTE_KEY, HealthController)).toBe(true);
  });
});
