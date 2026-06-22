import { describe, expect, it } from "vitest";
import { SCHEDULED_JOB_OPTIONS, buildFailedJobEvent, isExhausted } from "./queue-policy.js";

describe("scheduled queue policy", () => {
  it("retries three times with bounded exponential backoff and retains failures", () => {
    expect(SCHEDULED_JOB_OPTIONS).toEqual({
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: 50,
      removeOnFail: false,
    });
  });
});

describe("failed job events", () => {
  const job = {
    id: "42",
    name: "hold-expiry",
    attemptsMade: 3,
    opts: { attempts: 3 },
    data: { transactionRef: "must-not-log" },
  };

  it("identifies exhausted jobs", () => {
    expect(isExhausted(job)).toBe(true);
    expect(isExhausted({ ...job, attemptsMade: 2 })).toBe(false);
  });

  it("builds a payload-free dead-letter event", () => {
    const event = buildFailedJobEvent("court.holds.expiry", job);
    expect(event).toEqual({
      event: "dead-letter.retained",
      queue: "court.holds.expiry",
      jobId: "42",
      jobName: "hold-expiry",
      attemptsMade: 3,
    });
    expect(JSON.stringify(event)).not.toContain("must-not-log");
  });
});
