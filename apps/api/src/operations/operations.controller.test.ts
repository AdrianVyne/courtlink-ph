import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { SESSION_USER_KEY, type AuthenticatedRequest } from "../auth/session.guard.js";
import { OperationsController } from "./operations.controller.js";
import type { OperationsService, OperationsStatus } from "./operations.service.js";

const status: OperationsStatus = {
  overall: "ok",
  alerts: [],
  metrics: {
    processHeapRatio: 0.4,
    eventLoopDelayMs: 5,
    databaseRatio: 0.3,
    redisRatio: 0.2,
    failedJobs: 0,
  },
  dependencies: { database: true, redis: true },
  process: { heapUsedBytes: 40, heapLimitBytes: 100, eventLoopDelayMs: 5, uptimeSeconds: 60 },
  database: { usedBytes: 30, budgetBytes: 100 },
  redis: { usedBytes: 20, maxBytes: 100 },
  queues: [{ name: "court.holds.expiry", waiting: 0, active: 0, delayed: 1, failed: 0 }],
  failedJobs: [],
  capturedAt: "2026-06-22T00:00:00.000Z",
};

function request(roles: Array<"PLAYER" | "COACH" | "SUPER_ADMIN">): AuthenticatedRequest {
  return {
    [SESSION_USER_KEY]: {
      id: "user-1",
      email: "admin@example.com",
      displayName: "Admin",
      roles,
    },
  } as AuthenticatedRequest;
}

const service = { status: async () => status } as OperationsService;

describe("OperationsController", () => {
  it("rejects non-super-admin users", async () => {
    const controller = new OperationsController(service);
    await expect(controller.status(request(["PLAYER"]))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("returns detailed status to super admins", async () => {
    const controller = new OperationsController(service);
    await expect(controller.status(request(["SUPER_ADMIN"]))).resolves.toEqual(status);
  });

  it("returns aggregate numeric metrics without user data", async () => {
    const controller = new OperationsController(service);
    const metrics = await controller.metrics(request(["SUPER_ADMIN"]));
    expect(metrics).toMatchObject({
      courtlink_operational_level: 0,
      courtlink_queue_failed_jobs: 0,
      courtlink_database_usage_ratio: 0.3,
    });
    expect(JSON.stringify(metrics)).not.toContain("admin@example.com");
  });
});
