export const COACH_REVIEW_SLA_MS = 2 * 60 * 60 * 1000;
export const COACH_HOLD_MS = 5 * 60 * 1000;

export type CoachRequestStatus =
  | "PENDING_COACH"
  | "OPEN"
  | "MATCHED"
  | "CANCELLED"
  | "DECLINED"
  | "EXPIRED";
export type CoachOfferStatus = "ACTIVE" | "ACCEPTED" | "REJECTED" | "WITHDRAWN" | "EXPIRED";
export type CoachBookingStatus =
  | "HELD"
  | "PROOF_SUBMITTED"
  | "CONFIRMED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED"
  | "COMPLETED"
  | "REFUND_REQUESTED";

export interface CoachRequestRecord {
  id: string;
  playerId: string;
  targetCoachId: string | null;
  status: CoachRequestStatus;
  startsAt: Date;
  endsAt: Date;
  location: string;
  groupSize: number;
  skillLevel: string;
  goals: string | null;
  notes: string | null;
}

export interface CoachOfferRecord {
  id: string;
  requestId: string;
  coachId: string;
  status: CoachOfferStatus;
  amount: number;
  message: string | null;
  expiresAt: Date;
}

export interface CoachBookingRecord {
  id: string;
  requestId: string;
  offerId: string;
  coachId: string;
  playerId: string;
  status: CoachBookingStatus;
  startsAt: Date;
  endsAt: Date;
  location: string;
  amount: number;
  currency: "PHP";
  proofDeadline: Date | null;
  reviewDueAt: Date | null;
}

export interface CreateRequestInput {
  playerId: string;
  targetCoachId?: string | null;
  startsAt: Date;
  endsAt: Date;
  location: string;
  groupSize: number;
  skillLevel: string;
  goals?: string | null;
  notes?: string | null;
}

export interface CreateOfferInput {
  requestId: string;
  coachId: string;
  amount: number;
  message?: string | null;
  expiresAt: Date;
}

export interface AcceptOfferResult {
  booking: CoachBookingRecord;
  request: CoachRequestRecord;
}

export interface CoachMarketRepository {
  createRequest(input: CreateRequestInput, status: CoachRequestStatus): Promise<CoachRequestRecord>;
  updateRequestStatus(requestId: string, status: CoachRequestStatus): Promise<CoachRequestRecord>;
  getRequest(id: string): Promise<CoachRequestRecord | null>;
  listOpenRequests(limit: number): Promise<CoachRequestRecord[]>;
  createOffer(input: CreateOfferInput): Promise<CoachOfferRecord>;
  getOffer(id: string): Promise<CoachOfferRecord | null>;
  listOffersForRequest(requestId: string): Promise<CoachOfferRecord[]>;
  listOffersForCoach(coachId: string): Promise<CoachOfferRecord[]>;
  acceptOfferTransactionally(input: {
    offerId: string;
    now: Date;
    proofDeadline: Date;
  }): Promise<AcceptOfferResult>;
}

export class CoachMarketError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "CoachMarketError";
  }
}

export function offerIsAcceptable(offer: CoachOfferRecord, now: Date): boolean {
  return offer.status === "ACTIVE" && now.getTime() < offer.expiresAt.getTime();
}

export class CoachMarketService {
  constructor(private readonly repository: CoachMarketRepository) {}

  async createRequest(input: CreateRequestInput): Promise<CoachRequestRecord> {
    if (input.endsAt.getTime() <= input.startsAt.getTime()) {
      throw new CoachMarketError("REQUEST_RANGE_INVALID", "endsAt must be after startsAt");
    }
    if (input.groupSize < 1 || input.groupSize > 64) {
      throw new CoachMarketError("REQUEST_GROUP_SIZE_INVALID", "groupSize out of range");
    }
    if (input.location.trim().length < 2) {
      throw new CoachMarketError("REQUEST_LOCATION_REQUIRED", "Location is required");
    }
    const status: CoachRequestStatus = input.targetCoachId ? "PENDING_COACH" : "OPEN";
    return this.repository.createRequest({ ...input, location: input.location.trim() }, status);
  }

  async approveDirectedRequest(input: {
    requestId: string;
    coachId: string;
  }): Promise<CoachRequestRecord> {
    const request = await this.requirePendingDirectedRequest(input.requestId, input.coachId);
    return this.repository.updateRequestStatus(request.id, "OPEN");
  }

  async declineDirectedRequest(input: {
    requestId: string;
    coachId: string;
  }): Promise<CoachRequestRecord> {
    const request = await this.requirePendingDirectedRequest(input.requestId, input.coachId);
    return this.repository.updateRequestStatus(request.id, "DECLINED");
  }

  private async requirePendingDirectedRequest(
    requestId: string,
    coachId: string,
  ): Promise<CoachRequestRecord> {
    const request = await this.repository.getRequest(requestId);
    if (!request) throw new CoachMarketError("REQUEST_NOT_FOUND", "Request not found");
    if (request.status !== "PENDING_COACH") {
      throw new CoachMarketError("REQUEST_NOT_PENDING", `Request is ${request.status}`);
    }
    if (request.targetCoachId !== coachId) {
      throw new CoachMarketError("REQUEST_FORBIDDEN", "Request is not directed to you");
    }
    return request;
  }

  listOpenRequests(limit = 50): Promise<CoachRequestRecord[]> {
    return this.repository.listOpenRequests(limit);
  }

  async createOffer(input: CreateOfferInput & { now?: Date }): Promise<CoachOfferRecord> {
    const now = input.now ?? new Date();
    const request = await this.repository.getRequest(input.requestId);
    if (!request) throw new CoachMarketError("REQUEST_NOT_FOUND", "Request not found");
    if (request.status !== "OPEN") {
      throw new CoachMarketError("REQUEST_NOT_OPEN", `Request is ${request.status}`);
    }
    if (request.targetCoachId && request.targetCoachId !== input.coachId) {
      throw new CoachMarketError("REQUEST_TARGETED", "Request is directed to another coach");
    }
    if (input.amount <= 0) {
      throw new CoachMarketError("OFFER_AMOUNT_INVALID", "Amount must be positive");
    }
    if (input.expiresAt.getTime() <= now.getTime()) {
      throw new CoachMarketError("OFFER_EXPIRY_INVALID", "Expiry must be in the future");
    }
    if (input.expiresAt.getTime() > request.startsAt.getTime()) {
      throw new CoachMarketError(
        "OFFER_EXPIRY_AFTER_SESSION",
        "Offer must expire before the session begins",
      );
    }
    return this.repository.createOffer({
      requestId: input.requestId,
      coachId: input.coachId,
      amount: round2(input.amount),
      message: input.message ?? null,
      expiresAt: input.expiresAt,
    });
  }

  listOffersForRequest(requestId: string): Promise<CoachOfferRecord[]> {
    return this.repository.listOffersForRequest(requestId);
  }

  listOffersForCoach(coachId: string): Promise<CoachOfferRecord[]> {
    return this.repository.listOffersForCoach(coachId);
  }

  async acceptOffer(input: {
    offerId: string;
    playerId: string;
    now?: Date;
  }): Promise<AcceptOfferResult> {
    const now = input.now ?? new Date();
    const offer = await this.repository.getOffer(input.offerId);
    if (!offer) throw new CoachMarketError("OFFER_NOT_FOUND", "Offer not found");
    const request = await this.repository.getRequest(offer.requestId);
    if (!request) throw new CoachMarketError("REQUEST_NOT_FOUND", "Request not found");
    if (request.playerId !== input.playerId) {
      throw new CoachMarketError("REQUEST_FORBIDDEN", "Not your request");
    }
    if (request.status !== "OPEN") {
      throw new CoachMarketError("REQUEST_NOT_OPEN", `Request is ${request.status}`);
    }
    if (!offerIsAcceptable(offer, now)) {
      throw new CoachMarketError("OFFER_NOT_ACCEPTABLE", "Offer expired or inactive");
    }
    const proofDeadline = new Date(now.getTime() + COACH_HOLD_MS);
    return this.repository.acceptOfferTransactionally({ offerId: offer.id, now, proofDeadline });
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
