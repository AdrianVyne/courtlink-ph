import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import {
  type OperationsProbe,
  OperationsService,
  type RawOperationsSnapshot,
} from "./operations.service.js";

const rawSnapshot: RawOperationsSnapshot = {
  dependencies: { database: true, redis: true },
  process: { heapUsedBytes: 40, heapLimitBytes: 100, eventLoopDelayMs: 5, uptimeSeconds: 60 },
  database: { usedBytes: 30, budgetBytes: 100 },
  redis: { usedBytes: 20, maxBytes: 100 },
  queues: [{ name: "court.holds.expiry", waiting: 0, active: 0, delayed: 1, failed: 0 }],
  failedJobs: [],
  capturedAt: "2026-06-22T00:00:00.000Z",
};

function probe(overrides: Partial<OperationsProbe> = {}): OperationsProbe {
  return {
    checkDatabase: async () => true,
    checkRedis: async () => true,
    snapshot: async () => rawSnapshot,
    close: async () => undefined,
    ...overrides,
  };
}

describe("OperationsService", () => {
  it("reports readiness when PostgreSQL and Redis respond", async () => {
    const service = new OperationsService(probe(), 50);
    await expect(service.readiness()).resolves.toEqual({
      status: "ready",
      service: "courtlink-api",
    });
  });

  it("returns a stable 503 when a dependency is unavailable", async () => {
    const service = new OperationsService(probe({ checkRedis: async () => false }), 50);
    await expect(service.readiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("times out readiness probes", async () => {
    const service = new OperationsService(
      probe({ checkDatabase: () => new Promise<boolean>(() => undefined) }),
      5,
    );
    await expect(service.readiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("adds capacity assessment to the operational snapshot", async () => {
    const service = new OperationsService(probe(), 50);
    await expect(service.status()).resolves.toMatchObject({ overall: "ok", alerts: [] });
  });
});
