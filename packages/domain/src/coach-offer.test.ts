import { describe, expect, it } from "vitest";
import { CoachOfferStatus, canAcceptCoachOffer } from "./coach-offer.js";

describe("canAcceptCoachOffer", () => {
  it("accepts an active offer before its deadline", () => {
    expect(
      canAcceptCoachOffer({
        status: CoachOfferStatus.Active,
        expiresAt: new Date("2026-06-21T10:00:00.000Z"),
        now: new Date("2026-06-21T09:59:59.999Z"),
      }),
    ).toBe(true);
  });

  it("rejects an offer at its exact deadline", () => {
    expect(
      canAcceptCoachOffer({
        status: CoachOfferStatus.Active,
        expiresAt: new Date("2026-06-21T10:00:00.000Z"),
        now: new Date("2026-06-21T10:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("rejects an offer that is no longer active", () => {
    expect(
      canAcceptCoachOffer({
        status: CoachOfferStatus.Withdrawn,
        expiresAt: new Date("2026-06-21T10:00:00.000Z"),
        now: new Date("2026-06-21T09:00:00.000Z"),
      }),
    ).toBe(false);
  });
});
