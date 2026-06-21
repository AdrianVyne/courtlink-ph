import { describe, expect, it } from "vitest";
import { createCourtHold } from "./court-hold.js";

describe("createCourtHold", () => {
  it("creates a five-minute payment-proof deadline", () => {
    const createdAt = new Date("2026-06-21T08:00:00.000Z");

    expect(createCourtHold({ createdAt, courtId: "court-1", playerId: "player-1" })).toEqual({
      courtId: "court-1",
      playerId: "player-1",
      status: "held",
      proofDeadline: new Date("2026-06-21T08:05:00.000Z"),
    });
  });
});
