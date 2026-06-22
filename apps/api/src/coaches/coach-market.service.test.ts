import { describe, expect, it } from "vitest";
import {
  type AcceptOfferResult,
  type CoachBookingRecord,
  CoachMarketError,
  type CoachMarketRepository,
  CoachMarketService,
  type CoachOfferRecord,
  type CoachRequestRecord,
  type CoachRequestStatus,
  type CreateOfferInput,
  type CreateRequestInput,
  offerIsAcceptable,
} from "./coach-market.service.js";

class InMemoryCoachMarketRepo implements CoachMarketRepository {
  readonly requests: CoachRequestRecord[] = [];
  readonly offers: CoachOfferRecord[] = [];
  readonly bookings: CoachBookingRecord[] = [];

  async createRequest(
    input: CreateRequestInput,
    status: CoachRequestStatus,
  ): Promise<CoachRequestRecord> {
    const request: CoachRequestRecord = {
      id: `req-${this.requests.length + 1}`,
      playerId: input.playerId,
      targetCoachId: input.targetCoachId ?? null,
      status,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      location: input.location,
      groupSize: input.groupSize,
      skillLevel: input.skillLevel,
      goals: input.goals ?? null,
      notes: input.notes ?? null,
    };
    this.requests.push(request);
    return request;
  }

  async updateRequestStatus(
    requestId: string,
    status: CoachRequestStatus,
  ): Promise<CoachRequestRecord> {
    const request = this.requests.find((r) => r.id === requestId);
    if (!request) throw new CoachMarketError("REQUEST_NOT_FOUND", "missing");
    request.status = status;
    return request;
  }

  async getRequest(id: string): Promise<CoachRequestRecord | null> {
    return this.requests.find((r) => r.id === id) ?? null;
  }

  async listOpenRequests(limit: number): Promise<CoachRequestRecord[]> {
    return this.requests.filter((r) => r.status === "OPEN").slice(0, limit);
  }

  async createOffer(input: CreateOfferInput): Promise<CoachOfferRecord> {
    const offer: CoachOfferRecord = {
      id: `offer-${this.offers.length + 1}`,
      requestId: input.requestId,
      coachId: input.coachId,
      status: "ACTIVE",
      amount: input.amount,
      message: input.message ?? null,
      expiresAt: input.expiresAt,
    };
    this.offers.push(offer);
    return offer;
  }

  async getOffer(id: string): Promise<CoachOfferRecord | null> {
    return this.offers.find((o) => o.id === id) ?? null;
  }

  async listOffersForRequest(requestId: string): Promise<CoachOfferRecord[]> {
    return this.offers.filter((o) => o.requestId === requestId);
  }

  async listOffersForCoach(coachId: string): Promise<CoachOfferRecord[]> {
    return this.offers.filter((o) => o.coachId === coachId);
  }

  async acceptOfferTransactionally(input: {
    offerId: string;
    now: Date;
    proofDeadline: Date;
  }): Promise<AcceptOfferResult> {
    const offer = this.offers.find((o) => o.id === input.offerId);
    if (!offer) throw new CoachMarketError("OFFER_NOT_FOUND", "missing");
    const request = this.requests.find((r) => r.id === offer.requestId);
    if (!request) throw new CoachMarketError("REQUEST_NOT_FOUND", "missing");

    offer.status = "ACCEPTED";
    for (const other of this.offers) {
      if (other.requestId === request.id && other.id !== offer.id && other.status === "ACTIVE") {
        other.status = "REJECTED";
      }
    }
    request.status = "MATCHED";

    const booking: CoachBookingRecord = {
      id: `cbk-${this.bookings.length + 1}`,
      requestId: request.id,
      offerId: offer.id,
      coachId: offer.coachId,
      playerId: request.playerId,
      status: "HELD",
      startsAt: request.startsAt,
      endsAt: request.endsAt,
      location: request.location,
      amount: offer.amount,
      currency: "PHP",
      proofDeadline: input.proofDeadline,
      reviewDueAt: null,
    };
    this.bookings.push(booking);
    return { booking, request };
  }
}

function requestInput(overrides: Partial<CreateRequestInput> = {}): CreateRequestInput {
  return {
    playerId: "player-1",
    startsAt: new Date("2026-06-25T02:00:00.000Z"),
    endsAt: new Date("2026-06-25T03:00:00.000Z"),
    location: "Manila Pickleball Center",
    groupSize: 2,
    skillLevel: "beginner",
    ...overrides,
  };
}

describe("CoachMarketService requests", () => {
  it("creates an open request", async () => {
    const service = new CoachMarketService(new InMemoryCoachMarketRepo());
    const request = await service.createRequest(requestInput());
    expect(request.status).toBe("OPEN");
  });

  it("rejects invalid ranges and group sizes", async () => {
    const service = new CoachMarketService(new InMemoryCoachMarketRepo());
    await expect(
      service.createRequest(requestInput({ endsAt: new Date("2026-06-25T01:00:00.000Z") })),
    ).rejects.toBeInstanceOf(CoachMarketError);
    await expect(service.createRequest(requestInput({ groupSize: 0 }))).rejects.toBeInstanceOf(
      CoachMarketError,
    );
  });
});

describe("CoachMarketService offers", () => {
  function offerInput(overrides: Partial<CreateOfferInput> = {}): CreateOfferInput {
    return {
      requestId: "req-1",
      coachId: "coach-1",
      amount: 800,
      expiresAt: new Date("2026-06-25T00:00:00.000Z"),
      ...overrides,
    };
  }

  it("creates an offer that expires before the session", async () => {
    const repo = new InMemoryCoachMarketRepo();
    const service = new CoachMarketService(repo);
    await service.createRequest(requestInput());

    const offer = await service.createOffer({
      ...offerInput(),
      now: new Date("2026-06-24T12:00:00.000Z"),
    });
    expect(offer.status).toBe("ACTIVE");
    expect(offer.amount).toBe(800);
  });

  it("rejects offers expiring after the session start", async () => {
    const repo = new InMemoryCoachMarketRepo();
    const service = new CoachMarketService(repo);
    await service.createRequest(requestInput());

    await expect(
      service.createOffer({
        ...offerInput({ expiresAt: new Date("2026-06-25T02:30:00.000Z") }),
        now: new Date("2026-06-24T12:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "OFFER_EXPIRY_AFTER_SESSION" });
  });

  it("rejects offers from non-targeted coaches on an approved directed request", async () => {
    const repo = new InMemoryCoachMarketRepo();
    const service = new CoachMarketService(repo);
    const request = await service.createRequest(requestInput({ targetCoachId: "coach-9" }));
    await service.approveDirectedRequest({ requestId: request.id, coachId: "coach-9" });

    await expect(
      service.createOffer({
        ...offerInput({ requestId: request.id }),
        now: new Date("2026-06-24T12:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "REQUEST_TARGETED" });
  });
});

describe("CoachMarketService acceptance", () => {
  it("accepts one offer, rejects competitors, and matches the request", async () => {
    const repo = new InMemoryCoachMarketRepo();
    const service = new CoachMarketService(repo);
    await service.createRequest(requestInput());
    const now = new Date("2026-06-24T12:00:00.000Z");
    const winner = await service.createOffer({
      requestId: "req-1",
      coachId: "coach-1",
      amount: 800,
      expiresAt: new Date("2026-06-25T00:00:00.000Z"),
      now,
    });
    await service.createOffer({
      requestId: "req-1",
      coachId: "coach-2",
      amount: 900,
      expiresAt: new Date("2026-06-25T00:00:00.000Z"),
      now,
    });

    const result = await service.acceptOffer({
      offerId: winner.id,
      playerId: "player-1",
      now,
    });

    expect(result.booking.status).toBe("HELD");
    expect(result.booking.amount).toBe(800);
    expect(result.request.status).toBe("MATCHED");
    expect(repo.offers.find((o) => o.coachId === "coach-2")?.status).toBe("REJECTED");
  });

  it("refuses to accept an expired offer", async () => {
    const repo = new InMemoryCoachMarketRepo();
    const service = new CoachMarketService(repo);
    await service.createRequest(requestInput());
    const offer = await service.createOffer({
      requestId: "req-1",
      coachId: "coach-1",
      amount: 800,
      expiresAt: new Date("2026-06-25T00:00:00.000Z"),
      now: new Date("2026-06-24T12:00:00.000Z"),
    });

    await expect(
      service.acceptOffer({
        offerId: offer.id,
        playerId: "player-1",
        now: new Date("2026-06-25T01:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "OFFER_NOT_ACCEPTABLE" });
  });

  it("computes acceptability from status and expiry", () => {
    const base = {
      id: "o",
      requestId: "r",
      coachId: "c",
      amount: 1,
      message: null,
      expiresAt: new Date("2026-06-25T00:00:00.000Z"),
    };
    expect(
      offerIsAcceptable({ ...base, status: "ACTIVE" }, new Date("2026-06-24T00:00:00.000Z")),
    ).toBe(true);
    expect(
      offerIsAcceptable({ ...base, status: "ACTIVE" }, new Date("2026-06-26T00:00:00.000Z")),
    ).toBe(false);
    expect(
      offerIsAcceptable({ ...base, status: "WITHDRAWN" }, new Date("2026-06-24T00:00:00.000Z")),
    ).toBe(false);
  });
});

describe("CoachMarketService directed approval", () => {
  const now = new Date("2026-06-24T12:00:00.000Z");

  it("creates a directed request awaiting coach approval", async () => {
    const service = new CoachMarketService(new InMemoryCoachMarketRepo());
    const request = await service.createRequest(requestInput({ targetCoachId: "coach-1" }));
    expect(request.status).toBe("PENDING_COACH");
  });

  it("blocks offers until the targeted coach approves", async () => {
    const repo = new InMemoryCoachMarketRepo();
    const service = new CoachMarketService(repo);
    const request = await service.createRequest(requestInput({ targetCoachId: "coach-1" }));

    await expect(
      service.createOffer({
        requestId: request.id,
        coachId: "coach-1",
        amount: 800,
        expiresAt: new Date("2026-06-25T00:00:00.000Z"),
        now,
      }),
    ).rejects.toMatchObject({ code: "REQUEST_NOT_OPEN" });

    const approved = await service.approveDirectedRequest({
      requestId: request.id,
      coachId: "coach-1",
    });
    expect(approved.status).toBe("OPEN");

    const offer = await service.createOffer({
      requestId: request.id,
      coachId: "coach-1",
      amount: 800,
      expiresAt: new Date("2026-06-25T00:00:00.000Z"),
      now,
    });
    expect(offer.status).toBe("ACTIVE");
  });

  it("rejects approval by a coach who is not the target", async () => {
    const repo = new InMemoryCoachMarketRepo();
    const service = new CoachMarketService(repo);
    const request = await service.createRequest(requestInput({ targetCoachId: "coach-1" }));
    await expect(
      service.approveDirectedRequest({ requestId: request.id, coachId: "coach-2" }),
    ).rejects.toMatchObject({ code: "REQUEST_FORBIDDEN" });
  });

  it("declines a directed request and blocks further offers", async () => {
    const repo = new InMemoryCoachMarketRepo();
    const service = new CoachMarketService(repo);
    const request = await service.createRequest(requestInput({ targetCoachId: "coach-1" }));
    const declined = await service.declineDirectedRequest({
      requestId: request.id,
      coachId: "coach-1",
    });
    expect(declined.status).toBe("DECLINED");
    await expect(
      service.approveDirectedRequest({ requestId: request.id, coachId: "coach-1" }),
    ).rejects.toMatchObject({ code: "REQUEST_NOT_PENDING" });
  });

  it("rejects approving an open (non-directed) request", async () => {
    const repo = new InMemoryCoachMarketRepo();
    const service = new CoachMarketService(repo);
    const request = await service.createRequest(requestInput());
    await expect(
      service.approveDirectedRequest({ requestId: request.id, coachId: "coach-1" }),
    ).rejects.toMatchObject({ code: "REQUEST_NOT_PENDING" });
  });
});
