import { describe, expect, it } from "vitest";
import {
  type RefundBookingView,
  RefundError,
  type RefundRecord,
  type RefundRepository,
  RefundService,
} from "./refund.service.js";

class InMemoryRefundRepo implements RefundRepository {
  bookings = new Map<string, RefundBookingView>();
  refunds: RefundRecord[] = [];

  async getBooking(id: string) {
    return this.bookings.get(id) ?? null;
  }
  async getRefund(id: string) {
    return this.refunds.find((r) => r.id === id) ?? null;
  }
  async createRefundRequest(input: { bookingId: string; amount: number; reason: string }) {
    const refund: RefundRecord = {
      id: `refund-${this.refunds.length + 1}`,
      bookingId: input.bookingId,
      status: "REQUESTED",
      amount: input.amount,
      reason: input.reason,
      channel: null,
      transactionRef: null,
    };
    this.refunds.push(refund);
    const booking = this.bookings.get(input.bookingId);
    if (booking) booking.status = "REFUND_REQUESTED";
    return refund;
  }
  async decideRefund(input: { refundId: string; decision: "APPROVED" | "REJECTED"; now: Date }) {
    const refund = this.refunds.find((r) => r.id === input.refundId);
    if (!refund) throw new RefundError("REFUND_NOT_FOUND", "missing");
    refund.status = input.decision;
    const booking = this.bookings.get(refund.bookingId);
    if (booking) booking.status = input.decision === "APPROVED" ? "CANCELLED" : "CONFIRMED";
    return refund;
  }
  async completeRefund(input: {
    refundId: string;
    channel: RefundRecord["channel"];
    transactionRef: string;
    now: Date;
  }) {
    const refund = this.refunds.find((r) => r.id === input.refundId);
    if (!refund) throw new RefundError("REFUND_NOT_FOUND", "missing");
    refund.status = "COMPLETED";
    refund.channel = input.channel;
    refund.transactionRef = input.transactionRef;
    return refund;
  }
  async venueCancel(input: { bookingId: string; reason: string; amount: number }) {
    const refund: RefundRecord = {
      id: `refund-${this.refunds.length + 1}`,
      bookingId: input.bookingId,
      status: "APPROVED",
      amount: input.amount,
      reason: input.reason,
      channel: null,
      transactionRef: null,
    };
    this.refunds.push(refund);
    const booking = this.bookings.get(input.bookingId);
    if (booking) booking.status = "CANCELLED";
    return refund;
  }
}

function booking(overrides: Partial<RefundBookingView> = {}): RefundBookingView {
  return {
    id: "booking-1",
    playerId: "player-1",
    courtId: "court-1",
    status: "CONFIRMED",
    startsAt: new Date("2026-07-10T02:00:00.000Z"),
    quotedAmount: 250,
    ...overrides,
  };
}

describe("RefundService.requestRefund", () => {
  it("creates a refund request when at least seven days out", async () => {
    const repo = new InMemoryRefundRepo();
    repo.bookings.set("booking-1", booking());
    const service = new RefundService(repo);

    const refund = await service.requestRefund({
      bookingId: "booking-1",
      playerId: "player-1",
      reason: "Cannot make it",
      now: new Date("2026-07-01T00:00:00.000Z"),
    });

    expect(refund.status).toBe("REQUESTED");
    expect(refund.amount).toBe(250);
    expect(repo.bookings.get("booking-1")?.status).toBe("REFUND_REQUESTED");
  });

  it("rejects refunds requested fewer than seven days before play", async () => {
    const repo = new InMemoryRefundRepo();
    repo.bookings.set("booking-1", booking());
    const service = new RefundService(repo);

    await expect(
      service.requestRefund({
        bookingId: "booking-1",
        playerId: "player-1",
        reason: "late",
        now: new Date("2026-07-05T00:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "REFUND_NOT_ELIGIBLE" });
  });

  it("refuses refunds for bookings that are not confirmed", async () => {
    const repo = new InMemoryRefundRepo();
    repo.bookings.set("booking-1", booking({ status: "HELD" }));
    const service = new RefundService(repo);

    await expect(
      service.requestRefund({
        bookingId: "booking-1",
        playerId: "player-1",
        reason: "x",
        now: new Date("2026-07-01T00:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "REFUND_STATUS_INVALID" });
  });

  it("blocks players from refunding a booking they do not own", async () => {
    const repo = new InMemoryRefundRepo();
    repo.bookings.set("booking-1", booking());
    const service = new RefundService(repo);

    await expect(
      service.requestRefund({
        bookingId: "booking-1",
        playerId: "intruder",
        reason: "x",
        now: new Date("2026-07-01T00:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "BOOKING_FORBIDDEN" });
  });
});

describe("RefundService venue decisions", () => {
  it("approves then completes a refund with a manual payout record", async () => {
    const repo = new InMemoryRefundRepo();
    repo.bookings.set("booking-1", booking());
    const service = new RefundService(repo);
    const refund = await service.requestRefund({
      bookingId: "booking-1",
      playerId: "player-1",
      reason: "Cannot make it",
      now: new Date("2026-07-01T00:00:00.000Z"),
    });

    const approved = await service.decideRefund({ refundId: refund.id, decision: "APPROVED" });
    expect(approved.status).toBe("APPROVED");
    expect(repo.bookings.get("booking-1")?.status).toBe("CANCELLED");

    const completed = await service.completeRefund({
      refundId: refund.id,
      channel: "GCASH",
      transactionRef: "RF-123",
    });
    expect(completed.status).toBe("COMPLETED");
    expect(completed.transactionRef).toBe("RF-123");
  });

  it("returns the booking to confirmed when a refund is rejected", async () => {
    const repo = new InMemoryRefundRepo();
    repo.bookings.set("booking-1", booking());
    const service = new RefundService(repo);
    const refund = await service.requestRefund({
      bookingId: "booking-1",
      playerId: "player-1",
      reason: "Cannot make it",
      now: new Date("2026-07-01T00:00:00.000Z"),
    });

    const rejected = await service.decideRefund({ refundId: refund.id, decision: "REJECTED" });
    expect(rejected.status).toBe("REJECTED");
    expect(repo.bookings.get("booking-1")?.status).toBe("CONFIRMED");
  });

  it("lets a venue cancel a confirmed booking with an automatic refund", async () => {
    const repo = new InMemoryRefundRepo();
    repo.bookings.set("booking-1", booking());
    const service = new RefundService(repo);

    const refund = await service.cancelByVenue({ bookingId: "booking-1", reason: "Court flooded" });
    expect(refund.status).toBe("APPROVED");
    expect(repo.bookings.get("booking-1")?.status).toBe("CANCELLED");
  });
});
