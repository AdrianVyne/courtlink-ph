import { describe, expect, it } from "vitest";
import {
  BookingStatus,
  assertBookingTransition,
  canTransitionBooking,
} from "./booking-lifecycle.js";

describe("booking lifecycle", () => {
  it("allows a held booking to receive payment proof", () => {
    expect(canTransitionBooking(BookingStatus.Held, BookingStatus.ProofSubmitted)).toBe(true);
  });

  it("prevents confirmation before payment proof is reviewed", () => {
    expect(canTransitionBooking(BookingStatus.Held, BookingStatus.Confirmed)).toBe(false);
  });

  it("throws a stable error for an invalid transition", () => {
    expect(() => assertBookingTransition(BookingStatus.Expired, BookingStatus.Confirmed)).toThrow(
      "BOOKING_INVALID_TRANSITION:expired->confirmed",
    );
  });

  it("supports the reviewed payment and refund lifecycle", () => {
    expect(canTransitionBooking(BookingStatus.ProofSubmitted, BookingStatus.Confirmed)).toBe(true);
    expect(canTransitionBooking(BookingStatus.ProofSubmitted, BookingStatus.Rejected)).toBe(true);
    expect(canTransitionBooking(BookingStatus.Confirmed, BookingStatus.RefundRequested)).toBe(true);
    expect(canTransitionBooking(BookingStatus.RefundRequested, BookingStatus.Refunded)).toBe(true);
  });
});
