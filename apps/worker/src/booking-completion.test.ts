import { describe, expect, it } from "vitest";
import { BOOKING_COMPLETION_QUEUE } from "./booking-completion.js";

describe("booking completion queue", () => {
  it("uses a namespaced queue name", () => {
    expect(BOOKING_COMPLETION_QUEUE).toBe("bookings.completion");
  });
});
