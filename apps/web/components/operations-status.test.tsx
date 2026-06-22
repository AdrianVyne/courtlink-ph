import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { OperationsStatusSnapshot } from "../lib/api";
import { OperationsStatus } from "./operations-status";

const snapshot: OperationsStatusSnapshot = {
  overall: "warning",
  alerts: [{ code: "QUEUE_FAILURES_WARNING", level: "warning", message: "Jobs require review." }],
  metrics: {
    processHeapRatio: 0.4,
    eventLoopDelayMs: 5,
    databaseRatio: 0.3,
    redisRatio: 0.2,
    failedJobs: 1,
  },
  dependencies: { database: true, redis: true },
  process: { heapUsedBytes: 40, heapLimitBytes: 100, eventLoopDelayMs: 5, uptimeSeconds: 60 },
  database: { usedBytes: 30, budgetBytes: 100 },
  redis: { usedBytes: 20, maxBytes: 100 },
  queues: [{ name: "court.holds.expiry", waiting: 0, active: 0, delayed: 1, failed: 1 }],
  failedJobs: [
    {
      queue: "court.holds.expiry",
      id: "42",
      name: "hold-expiry",
      attemptsMade: 3,
      failedAt: "2026-06-22T00:00:00.000Z",
      error: "Database unavailable",
    },
  ],
  capturedAt: "2026-06-22T00:00:00.000Z",
};

describe("OperationsStatus", () => {
  it("renders dependencies, alerts, queues, and sanitized failed jobs", () => {
    render(<OperationsStatus snapshot={snapshot} />);

    expect(screen.getByText("Operational warning")).toBeTruthy();
    expect(screen.getByText("PostgreSQL")).toBeTruthy();
    expect(screen.getByText("court.holds.expiry")).toBeTruthy();
    expect(screen.getByText("Database unavailable")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
