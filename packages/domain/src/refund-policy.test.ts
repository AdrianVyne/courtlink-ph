import { describe, expect, it } from "vitest";
import { CancellationCause, isRefundEligible } from "./refund-policy.js";

describe("isRefundEligible", () => {
  const bookingStartsAt = new Date("2026-07-08T10:00:00.000Z");

  it("allows a player request exactly seven days before play", () => {
    expect(
      isRefundEligible({
        bookingStartsAt,
        requestedAt: new Date("2026-07-01T10:00:00.000Z"),
        cause: CancellationCause.Player,
      }),
    ).toBe(true);
  });

  it("rejects a player request inside the seven-day boundary", () => {
    expect(
      isRefundEligible({
        bookingStartsAt,
        requestedAt: new Date("2026-07-01T10:00:00.001Z"),
        cause: CancellationCause.Player,
      }),
    ).toBe(false);
  });

  it("allows a venue-caused cancellation regardless of notice", () => {
    expect(
      isRefundEligible({
        bookingStartsAt,
        requestedAt: new Date("2026-07-08T09:59:00.000Z"),
        cause: CancellationCause.Venue,
      }),
    ).toBe(true);
  });
});
