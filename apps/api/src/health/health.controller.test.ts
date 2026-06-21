import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import { HealthController } from "./health.controller.js";

describe("HealthController", () => {
  it("reports API readiness without exposing internals", async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [HealthController] }).compile();
    const controller = moduleRef.get(HealthController);

    expect(controller.readiness()).toEqual({ status: "ready", service: "courtlink-api" });
  });
});
