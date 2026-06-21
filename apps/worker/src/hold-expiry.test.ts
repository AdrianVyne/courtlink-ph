import { describe, expect, it } from "vitest";
import { HOLD_EXPIRY_QUEUE } from "./hold-expiry.js";

describe("hold-expiry queue identifier", () => {
  it("uses a namespaced queue name to avoid collisions", () => {
    expect(HOLD_EXPIRY_QUEUE).toBe("court.holds.expiry");
  });
});
