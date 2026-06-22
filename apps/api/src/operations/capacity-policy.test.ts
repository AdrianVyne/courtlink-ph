import { describe, expect, it } from "vitest";
import { buildCapacityAssessment, classifyCount, classifyRatio } from "./capacity-policy.js";

describe("capacity classification", () => {
  it("uses warning and critical ratio thresholds", () => {
    expect(classifyRatio(0.69)).toBe("ok");
    expect(classifyRatio(0.7)).toBe("warning");
    expect(classifyRatio(0.85)).toBe("critical");
  });

  it("classifies failed-job counts", () => {
    expect(classifyCount(0)).toBe("ok");
    expect(classifyCount(1)).toBe("warning");
    expect(classifyCount(10)).toBe("critical");
  });

  it("returns stable alert codes for pressured resources", () => {
    const assessment = buildCapacityAssessment({
      heapUsedBytes: 80,
      heapLimitBytes: 100,
      eventLoopDelayMs: 600,
      databaseBytes: 20,
      databaseBudgetBytes: 100,
      redisUsedBytes: 90,
      redisMaxBytes: 100,
      failedJobs: 2,
    });

    expect(assessment.overall).toBe("critical");
    expect(assessment.alerts.map((alert) => alert.code)).toEqual([
      "PROCESS_HEAP_WARNING",
      "EVENT_LOOP_CRITICAL",
      "REDIS_MEMORY_CRITICAL",
      "QUEUE_FAILURES_WARNING",
    ]);
  });
});
