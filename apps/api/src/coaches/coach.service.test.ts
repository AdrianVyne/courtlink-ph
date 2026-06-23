import { describe, expect, it } from "vitest";
import {
  type AddAvailabilityInput,
  type AvailabilitySummary,
  CoachError,
  type CoachProfileFilters,
  type CoachProfileSummary,
  type PublicCoachDetail,
  type CoachRepository,
  CoachService,
  type UpsertProfileInput,
} from "./coach.service.js";

class InMemoryCoachRepo implements CoachRepository {
  readonly profiles: CoachProfileSummary[] = [];
  readonly availability: AvailabilitySummary[] = [];

  async upsertProfile(input: UpsertProfileInput): Promise<CoachProfileSummary> {
    const existing = this.profiles.find((p) => p.userId === input.userId);
    if (existing) {
      existing.bio = input.bio ?? null;
      existing.experience = input.experience ?? null;
      existing.hourlyRate = input.hourlyRate;
      return existing;
    }
    const profile: CoachProfileSummary = {
      id: `coach-${this.profiles.length + 1}`,
      userId: input.userId,
      bio: input.bio ?? null,
      experience: input.experience ?? null,
      hourlyRate: input.hourlyRate,
      verificationStatus: "UNVERIFIED",
      active: true,
    };
    this.profiles.push(profile);
    return profile;
  }

  async findProfileByUserId(userId: string): Promise<CoachProfileSummary | null> {
    return this.profiles.find((p) => p.userId === userId) ?? null;
  }

  async findProfileById(id: string): Promise<CoachProfileSummary | null> {
    return this.profiles.find((p) => p.id === id) ?? null;
  }

  async findPublicDetail(id: string): Promise<PublicCoachDetail | null> {
    const profile = this.profiles.find((p) => p.id === id && p.active);
    if (!profile) return null;
    return {
      ...profile,
      displayName: "Test Coach",
      availability: this.availability.filter((a) => a.coachId === id),
    };
  }

  async listPublicProfiles(filters: CoachProfileFilters): Promise<CoachProfileSummary[]> {
    return this.profiles.filter(
      (p) => p.active && (!filters.verifiedOnly || p.verificationStatus === "VERIFIED"),
    );
  }

  async setVerification(
    coachId: string,
    status: CoachProfileSummary["verificationStatus"],
  ): Promise<CoachProfileSummary> {
    const profile = this.profiles.find((p) => p.id === coachId);
    if (!profile) throw new CoachError("COACH_NOT_FOUND", "missing");
    profile.verificationStatus = status;
    return profile;
  }

  async addAvailability(input: AddAvailabilityInput): Promise<AvailabilitySummary> {
    const slot: AvailabilitySummary = {
      id: `slot-${this.availability.length + 1}`,
      coachId: input.coachId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      location: input.location,
      active: true,
    };
    this.availability.push(slot);
    return slot;
  }

  async listAvailability(coachId: string): Promise<AvailabilitySummary[]> {
    return this.availability.filter((s) => s.coachId === coachId);
  }
}

describe("CoachService", () => {
  it("creates a profile defaulting to unverified", async () => {
    const service = new CoachService(new InMemoryCoachRepo());
    const profile = await service.upsertProfile({ userId: "user-1", hourlyRate: 750 });
    expect(profile.verificationStatus).toBe("UNVERIFIED");
    expect(profile.hourlyRate).toBe(750);
  });

  it("rejects non-positive rates", async () => {
    const service = new CoachService(new InMemoryCoachRepo());
    await expect(service.upsertProfile({ userId: "user-1", hourlyRate: 0 })).rejects.toMatchObject({
      code: "COACH_RATE_INVALID",
    });
  });

  it("only lists verified profiles when filtered", async () => {
    const repo = new InMemoryCoachRepo();
    const service = new CoachService(repo);
    const unverified = await service.upsertProfile({ userId: "user-1", hourlyRate: 500 });
    const verified = await service.upsertProfile({ userId: "user-2", hourlyRate: 600 });
    await service.setVerification(verified.id, "VERIFIED");

    const all = await service.listPublicProfiles({});
    const onlyVerified = await service.listPublicProfiles({ verifiedOnly: true });
    expect(all.map((p) => p.id)).toEqual([unverified.id, verified.id]);
    expect(onlyVerified.map((p) => p.id)).toEqual([verified.id]);
  });

  it("validates availability ranges", async () => {
    const service = new CoachService(new InMemoryCoachRepo());
    await expect(
      service.addAvailability({
        coachId: "coach-1",
        startsAt: new Date("2026-06-25T03:00:00.000Z"),
        endsAt: new Date("2026-06-25T02:00:00.000Z"),
        location: "Center",
      }),
    ).rejects.toMatchObject({ code: "AVAILABILITY_RANGE_INVALID" });
  });
});
