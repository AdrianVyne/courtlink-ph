import { describe, expect, it } from "vitest";
import {
  CoachRefundError,
  CoachRefundService,
  type CoachRefundBookingView,
  type CoachRefundRecord,
  type CoachRefundRepository,
} from "./coach-refund.service.js";

class InMemoryRepo implements CoachRefundRepository {
  bookings: CoachRefundBookingView[] = [];
  refunds: CoachRefundRecord[] = [];
  bookingStatus = new Map<string, string>();

  async getBooking(id: string): Promise<CoachRefundBookingView | null> {
    return this.bookings.find((b) => b.id === id) ?? null;
  }
  async getRefund(id: string): Promise<CoachRefundRecord | null> {
    return this.refunds.find((r) => r.id === id) ?? null;
  }
  async createRefundRequest(input: {
    bookingId: string;
    amount: number;
    reason: string;
  }): Promise<CoachRefundRecord> {
    const booking = this.bookings.find((b) => b.id === input.bookingId);
    if (!booking || booking.status !== "CONFIRMED") throw new Error("STATUS_CONFLICT");
    booking.status = "REFUND_REQUESTED";
    const refund: CoachRefundRecord = {
      id: `ref-${this.refunds.length + 1}`,
      bookingId: input.bookingId,
      status: "REQUESTED",
      amount: input.amount,
      reason: input.reason,
      channel: null,
      transactionRef: null,
    };
    this.refunds.push(refund);
    return refund;
  }
  async decideRefund(input: {
    refundId: string;
    decision: "APPROVED" | "REJECTED";
    now: Date;
  }): Promise<CoachRefundRecord> {
    const refund = this.refunds.find((r) => r.id === input.refundId);
    if (!refund) throw new Error("MISSING");
    refund.status = input.decision;
    const booking = this.bookings.find((b) => b.id === refund.bookingId);
    if (booking) booking.status = input.decision === "APPROVED" ? "CANCELLED" : "CONFIRMED";
    return refund;
  }
  async completeRefund(input: {
    refundId: string;
    channel: CoachRefundRecord["channel"];
    transactionRef: string;
    now: Date;
  }): Promise<CoachRefundRecord> {
    const refund = this.refunds.find((r) => r.id === input.refundId);
    if (!refund) throw new Error("MISSING");
    refund.status = "COMPLETED";
    refund.channel = input.channel;
    refund.transactionRef = input.transactionRef;
    return refund;
  }
  async coachCancel(input: {
    bookingId: string;
    reason: string;
    amount: number;
  }): Promise<CoachRefundRecord> {
    const booking = this.bookings.find((b) => b.id === input.bookingId);
    if (!booking) throw new Error("MISSING");
    booking.status = "CANCELLED";
    const refund: CoachRefundRecord = {
      id: `ref-${this.refunds.length + 1}`,
      bookingId: input.bookingId,
      status: "APPROVED",
      amount: input.amount,
      reason: input.reason,
      channel: null,
      transactionRef: null,
    };
    this.refunds.push(refund);
    return refund;
  }
}

function build() {
  const repo = new InMemoryRepo();
  return { repo, service: new CoachRefundService(repo) };
}

function booking(overrides: Partial<CoachRefundBookingView> = {}): CoachRefundBookingView {
  return {
    id: "cbk-1",
    playerId: "player-1",
    coachId: "coach-1",
    status: "CONFIRMED",
    startsAt: new Date("2026-07-30T02:00:00.000Z"),
    amount: 800,
    ...overrides,
  };
}

describe("player coach refund requests", () => {
  it("creates a refund request at least seven days before the session", async () => {
    const { repo, service } = build();
    repo.bookings.push(booking());
    const refund = await service.requestRefund({
      bookingId: "cbk-1",
      playerId: "player-1",
      reason: "Schedule clash",
      now: new Date("2026-07-01T00:00:00.000Z"),
    });
    expect(refund.status).toBe("REQUESTED");
    expect(refund.amount).toBe(800);
    expect(repo.bookings[0]?.status).toBe("REFUND_REQUESTED");
  });

  it("rejects a refund inside the seven-day window", async () => {
    const { repo, service } = build();
    repo.bookings.push(booking());
    await expect(
      service.requestRefund({
        bookingId: "cbk-1",
        playerId: "player-1",
        reason: "Late",
        now: new Date("2026-07-29T00:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "REFUND_NOT_ELIGIBLE" });
  });

  it("rejects refunds for non-owners", async () => {
    const { repo, service } = build();
    repo.bookings.push(booking());
    await expect(
      service.requestRefund({
        bookingId: "cbk-1",
        playerId: "intruder",
        reason: "x",
        now: new Date("2026-07-01T00:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "COACH_BOOKING_FORBIDDEN" });
  });

  it("rejects refunds on non-confirmed bookings", async () => {
    const { repo, service } = build();
    repo.bookings.push(booking({ status: "HELD" }));
    await expect(
      service.requestRefund({
        bookingId: "cbk-1",
        playerId: "player-1",
        reason: "x",
        now: new Date("2026-07-01T00:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "REFUND_STATUS_INVALID" });
  });
});

describe("coach refund decisions and cancellation", () => {
  it("approves then completes a refund", async () => {
    const { repo, service } = build();
    repo.bookings.push(booking());
    const refund = await service.requestRefund({
      bookingId: "cbk-1",
      playerId: "player-1",
      reason: "Clash",
      now: new Date("2026-07-01T00:00:00.000Z"),
    });
    const approved = await service.decideRefund({ refundId: refund.id, decision: "APPROVED" });
    expect(approved.status).toBe("APPROVED");
    const completed = await service.completeRefund({
      refundId: refund.id,
      channel: "GCASH",
      transactionRef: "REF-1",
    });
    expect(completed.status).toBe("COMPLETED");
    expect(completed.channel).toBe("GCASH");
  });

  it("only completes approved refunds", async () => {
    const { repo, service } = build();
    repo.bookings.push(booking());
    const refund = await service.requestRefund({
      bookingId: "cbk-1",
      playerId: "player-1",
      reason: "Clash",
      now: new Date("2026-07-01T00:00:00.000Z"),
    });
    await expect(
      service.completeRefund({ refundId: refund.id, channel: "GCASH", transactionRef: "REF" }),
    ).rejects.toMatchObject({ code: "REFUND_STATUS_INVALID" });
  });

  it("lets a coach cancel a confirmed booking with an always-eligible refund", async () => {
    const { repo, service } = build();
    repo.bookings.push(booking());
    const refund = await service.cancelByCoach({ bookingId: "cbk-1", reason: "Coach injured" });
    expect(refund.status).toBe("APPROVED");
    expect(repo.bookings[0]?.status).toBe("CANCELLED");
  });
});
