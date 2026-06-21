import type { CoachAvailability, CoachProfile, CoachVerificationStatus } from "@courtlink/database";

export interface CoachProfileSummary {
  id: string;
  userId: string;
  bio: string | null;
  experience: string | null;
  hourlyRate: number;
  verificationStatus: CoachVerificationStatus;
  active: boolean;
}

export interface AvailabilitySummary {
  id: string;
  coachId: string;
  startsAt: Date;
  endsAt: Date;
  location: string;
  active: boolean;
}

export interface UpsertProfileInput {
  userId: string;
  bio?: string | null | undefined;
  experience?: string | null | undefined;
  hourlyRate: number;
}

export interface AddAvailabilityInput {
  coachId: string;
  startsAt: Date;
  endsAt: Date;
  location: string;
}

export interface CoachProfileFilters {
  verifiedOnly?: boolean;
  limit?: number | undefined;
}

export interface CoachRepository {
  upsertProfile(input: UpsertProfileInput): Promise<CoachProfileSummary>;
  findProfileByUserId(userId: string): Promise<CoachProfileSummary | null>;
  findProfileById(id: string): Promise<CoachProfileSummary | null>;
  listPublicProfiles(filters: CoachProfileFilters): Promise<CoachProfileSummary[]>;
  setVerification(coachId: string, status: CoachVerificationStatus): Promise<CoachProfileSummary>;
  addAvailability(input: AddAvailabilityInput): Promise<AvailabilitySummary>;
  listAvailability(coachId: string): Promise<AvailabilitySummary[]>;
}

export class CoachError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "CoachError";
  }
}

export class CoachService {
  constructor(private readonly repository: CoachRepository) {}

  async upsertProfile(input: UpsertProfileInput): Promise<CoachProfileSummary> {
    if (input.hourlyRate <= 0) throw new CoachError("COACH_RATE_INVALID", "Rate must be positive");
    return this.repository.upsertProfile({
      userId: input.userId,
      bio: input.bio ?? null,
      experience: input.experience ?? null,
      hourlyRate: round2(input.hourlyRate),
    });
  }

  findProfileByUserId(userId: string): Promise<CoachProfileSummary | null> {
    return this.repository.findProfileByUserId(userId);
  }

  findProfileById(id: string): Promise<CoachProfileSummary | null> {
    return this.repository.findProfileById(id);
  }

  listPublicProfiles(filters: CoachProfileFilters): Promise<CoachProfileSummary[]> {
    return this.repository.listPublicProfiles({ ...filters, limit: filters.limit ?? 50 });
  }

  setVerification(coachId: string, status: CoachVerificationStatus): Promise<CoachProfileSummary> {
    return this.repository.setVerification(coachId, status);
  }

  async addAvailability(input: AddAvailabilityInput): Promise<AvailabilitySummary> {
    if (input.endsAt.getTime() <= input.startsAt.getTime()) {
      throw new CoachError("AVAILABILITY_RANGE_INVALID", "endsAt must be after startsAt");
    }
    if (input.location.trim().length < 2) {
      throw new CoachError("AVAILABILITY_LOCATION_REQUIRED", "Location is required");
    }
    return this.repository.addAvailability({ ...input, location: input.location.trim() });
  }

  listAvailability(coachId: string): Promise<AvailabilitySummary[]> {
    return this.repository.listAvailability(coachId);
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function toCoachProfileSummary(profile: CoachProfile): CoachProfileSummary {
  return {
    id: profile.id,
    userId: profile.userId,
    bio: profile.bio,
    experience: profile.experience,
    hourlyRate: Number(profile.hourlyRate),
    verificationStatus: profile.verificationStatus,
    active: profile.active,
  };
}

export function toAvailabilitySummary(row: CoachAvailability): AvailabilitySummary {
  return {
    id: row.id,
    coachId: row.coachId,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    location: row.location,
    active: row.active,
  };
}
