import { describe, expect, it } from "vitest";
import {
  IDEMPOTENCY_PRUNE_QUEUE,
  IDEMPOTENCY_RETENTION_MS,
  retentionCutoff,
} from "./idempotency-prune.js";

describe("idempotency prune policy", () => {
  it("uses a namespaced queue name", () => {
    expect(IDEMPOTENCY_PRUNE_QUEUE).toBe("idempotency.records.prune");
  });

  it("retains records for 24 hours", () => {
    expect(IDEMPOTENCY_RETENTION_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("computes a cutoff 24 hours before now", () => {
    const now = new Date("2026-06-22T12:00:00.000Z");
    expect(retentionCutoff(now).toISOString()).toBe("2026-06-21T12:00:00.000Z");
  });
});
