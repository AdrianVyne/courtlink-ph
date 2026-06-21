import { describe, expect, it } from "vitest";
import {
  BookingError,
  type BookingRecord,
  type BookingRepository,
  BookingService,
  HOLD_DURATION_MS,
  type PaymentSubmissionRecord,
} from "./booking.service.js";
import {
  CourtService,
  type CourtRepository,
  type CourtSummary,
  type PricingRule,
} from "./court.service.js";

class FakeBookingRepo implements BookingRepository {
  readonly bookings: BookingRecord[] = [];
  readonly submissions: PaymentSubmissionRecord[] = [];

  async createHold(input: {
    courtId: string;
    playerId: string;
    startsAt: Date;
    endsAt: Date;
    quotedAmount: number;
    proofDeadline: Date;
  }): Promise<BookingRecord> {
    const record: BookingRecord = {
      id: `booking-${this.bookings.length + 1}`,
      courtId: input.courtId,
      playerId: input.playerId,
      status: "HELD",
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      quotedAmount: input.quotedAmount,
      currency: "PHP",
      proofDeadline: input.proofDeadline,
      reviewDueAt: null,
      createdAt: new Date(),
    };
    this.bookings.push(record);
    return record;
  }

  async getBooking(id: string): Promise<BookingRecord | null> {
    return this.bookings.find((b) => b.id === id) ?? null;
  }

  async getSubmission(id: string) {
    const submission = this.submissions.find((s) => s.id === id);
    if (!submission) return null;
    return {
      id: submission.id,
      bookingId: submission.bookingId,
      proofObjectKey: submission.proofObjectKey,
    };
  }

  async transitionStatus(
    id: string,
    expected: BookingRecord["status"],
    next: BookingRecord["status"],
    extras?: { reviewDueAt?: Date | null },
  ): Promise<BookingRecord> {
    const booking = this.bookings.find((b) => b.id === id);
    if (!booking) throw new BookingError("BOOKING_NOT_FOUND", "missing");
    if (booking.status !== expected)
      throw new BookingError(
        "BOOKING_STATUS_INVALID",
        `expected ${expected}, got ${booking.status}`,
      );
    booking.status = next;
    if (extras?.reviewDueAt !== undefined) booking.reviewDueAt = extras.reviewDueAt;
    return booking;
  }

  async submitPayment(input: {
    bookingId: string;
    channel: PaymentSubmissionRecord["channel"];
    transactionRef: string;
    proofObjectKey: string;
  }): Promise<PaymentSubmissionRecord> {
    const submission: PaymentSubmissionRecord = {
      id: `sub-${this.submissions.length + 1}`,
      bookingId: input.bookingId,
      channel: input.channel,
      transactionRef: input.transactionRef,
      proofObjectKey: input.proofObjectKey,
      status: "PENDING",
    };
    this.submissions.push(submission);
    return submission;
  }

  async decidePayment(input: {
    submissionId: string;
    decision: "APPROVED" | "REJECTED";
    reviewedById: string;
    reason: string | null;
  }): Promise<PaymentSubmissionRecord> {
    const submission = this.submissions.find((s) => s.id === input.submissionId);
    if (!submission) throw new BookingError("SUBMISSION_NOT_FOUND", "missing");
    submission.status = input.decision;
    void input.reviewedById;
    void input.reason;
    return submission;
  }

  async expireStaleHolds(now: Date): Promise<number> {
    let count = 0;
    for (const booking of this.bookings) {
      if (booking.status === "HELD" && booking.proofDeadline <= now) {
        booking.status = "EXPIRED";
        count++;
      }
    }
    return count;
  }
}

class FakeCourtRepo implements CourtRepository {
  readonly court: CourtSummary = {
    id: "court-1",
    venueId: "venue-1",
    name: "Court A",
    description: null,
    indoor: false,
    active: true,
    slotIncrementMin: 30,
    minimumDurationMin: 60,
    maximumDurationMin: 240,
  };
  readonly rule: PricingRule = {
    id: "rule-1",
    dayOfWeek: null,
    startsMinute: 0,
    endsMinute: 24 * 60,
    pricePerHour: 200,
    priority: 0,
    effectiveFrom: null,
    effectiveUntil: null,
  };

  async createCourt() {
    return this.court;
  }
  async listCourtsForVenue() {
    return [this.court];
  }
  async findCourtById() {
    return this.court;
  }
  async listPricingRules() {
    return [this.rule];
  }
}

describe("BookingService", () => {
  const courts = new CourtService(new FakeCourtRepo());
  void courts;

  it("creates a HELD booking with a 5-minute proof deadline", async () => {
    const repo = new FakeBookingRepo();
    const service = new BookingService(repo, new FakeCourtRepo());
    const now = new Date("2026-06-21T00:00:00.000Z");

    const booking = await service.createHold({
      courtId: "court-1",
      playerId: "player-1",
      startsAt: new Date("2026-06-21T01:00:00.000Z"),
      endsAt: new Date("2026-06-21T02:00:00.000Z"),
      now,
    });

    expect(booking.status).toBe("HELD");
    expect(booking.quotedAmount).toBe(200);
    expect(booking.proofDeadline.getTime() - now.getTime()).toBe(HOLD_DURATION_MS);
  });

  it("transitions to PROOF_SUBMITTED and sets a two-hour review SLA", async () => {
    const repo = new FakeBookingRepo();
    const service = new BookingService(repo, new FakeCourtRepo());
    const now = new Date("2026-06-21T00:00:00.000Z");
    const booking = await service.createHold({
      courtId: "court-1",
      playerId: "player-1",
      startsAt: new Date("2026-06-21T01:00:00.000Z"),
      endsAt: new Date("2026-06-21T02:00:00.000Z"),
      now,
    });

    const result = await service.submitProof({
      bookingId: booking.id,
      playerId: "player-1",
      channel: "GCASH",
      transactionRef: "TX-123",
      proofObjectKey: "proofs/abc.jpg",
      now: new Date(now.getTime() + 60_000),
    });

    expect(result.booking.status).toBe("PROOF_SUBMITTED");
    expect(result.booking.reviewDueAt?.getTime()).toBe(now.getTime() + 60_000 + 2 * 60 * 60 * 1000);
    expect(result.submission.status).toBe("PENDING");
  });

  it("rejects late proof submissions after the hold expires", async () => {
    const repo = new FakeBookingRepo();
    const service = new BookingService(repo, new FakeCourtRepo());
    const now = new Date("2026-06-21T00:00:00.000Z");
    const booking = await service.createHold({
      courtId: "court-1",
      playerId: "player-1",
      startsAt: new Date("2026-06-21T01:00:00.000Z"),
      endsAt: new Date("2026-06-21T02:00:00.000Z"),
      now,
    });

    await expect(
      service.submitProof({
        bookingId: booking.id,
        playerId: "player-1",
        channel: "GCASH",
        transactionRef: "TX-LATE",
        proofObjectKey: "proofs/late.jpg",
        now: new Date(booking.proofDeadline.getTime() + 1),
      }),
    ).rejects.toMatchObject({ code: "HOLD_EXPIRED" });
  });

  it("confirms a booking when the venue approves the proof", async () => {
    const repo = new FakeBookingRepo();
    const service = new BookingService(repo, new FakeCourtRepo());
    const now = new Date("2026-06-21T00:00:00.000Z");
    const booking = await service.createHold({
      courtId: "court-1",
      playerId: "player-1",
      startsAt: new Date("2026-06-21T01:00:00.000Z"),
      endsAt: new Date("2026-06-21T02:00:00.000Z"),
      now,
    });
    const { submission } = await service.submitProof({
      bookingId: booking.id,
      playerId: "player-1",
      channel: "GCASH",
      transactionRef: "TX-OK",
      proofObjectKey: "proofs/ok.jpg",
      now,
    });

    const confirmed = await service.approveProof({
      submissionId: submission.id,
      bookingId: booking.id,
      reviewedById: "staff-1",
    });

    expect(confirmed.status).toBe("CONFIRMED");
  });
});
