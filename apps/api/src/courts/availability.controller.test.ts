import { describe, expect, it, vi } from "vitest";
import { PUBLIC_ROUTE_KEY } from "../auth/session.guard.js";
import { AvailabilityController } from "./availability.controller.js";
import type { AvailabilityService } from "./availability.service.js";

describe("AvailabilityController", () => {
  it("coerces public date and duration query values", async () => {
    const listPricedSlots = vi.fn().mockResolvedValue([]);
    const controller = new AvailabilityController({
      listPricedSlots,
    } as unknown as AvailabilityService);

    await expect(
      controller.list("court-1", { date: "2026-06-22", durationMin: "60" }),
    ).resolves.toEqual([]);
    expect(listPricedSlots).toHaveBeenCalledWith("court-1", "2026-06-22", 60);
  });

  it("marks availability as public", () => {
    expect(Reflect.getMetadata(PUBLIC_ROUTE_KEY, AvailabilityController.prototype.list)).toBe(true);
  });
});
