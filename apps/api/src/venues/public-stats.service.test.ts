import { describe, expect, it } from "vitest";
import { PublicStatsService } from "./public-stats.service.js";

describe("PublicStatsService", () => {
  it("returns marketplace counts from the repository", async () => {
    const service = new PublicStatsService({
      counts: async () => ({ venues: 12, cities: 5, coaches: 8 }),
    });
    await expect(service.getPublicStats()).resolves.toEqual({
      venues: 12,
      cities: 5,
      coaches: 8,
    });
  });

  it("never returns negative counts", async () => {
    const service = new PublicStatsService({
      counts: async () => ({ venues: -1, cities: -3, coaches: 0 }),
    });
    await expect(service.getPublicStats()).resolves.toEqual({
      venues: 0,
      cities: 0,
      coaches: 0,
    });
  });
});
