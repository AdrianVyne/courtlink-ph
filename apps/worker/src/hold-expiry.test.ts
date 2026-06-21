import { describe, expect, it } from "vitest";
import { shouldExpireHold } from "./hold-expiry.js";

describe("shouldExpireHold", () => {
  it("expires a hold at its exact deadline", () => {
    const deadline = new Date("2026-06-21T12:05:00.000Z");

    expect(shouldExpireHold(deadline, new Date("2026-06-21T12:05:00.000Z"))).toBe(true);
  });

  it("keeps a hold active before its deadline", () => {
    const deadline = new Date("2026-06-21T12:05:00.000Z");

    expect(shouldExpireHold(deadline, new Date("2026-06-21T12:04:59.999Z"))).toBe(false);
  });
});
