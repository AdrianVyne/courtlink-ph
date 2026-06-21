import type { CoachVerificationStatus, Prisma, PrismaClient } from "@courtlink/database";
import {
  type AddAvailabilityInput,
  type AvailabilitySummary,
  type CoachProfileFilters,
  type CoachProfileSummary,
  type CoachRepository,
  type UpsertProfileInput,
  toAvailabilitySummary,
  toCoachProfileSummary,
} from "./coach.service.js";

export class PrismaCoachRepository implements CoachRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertProfile(input: UpsertProfileInput): Promise<CoachProfileSummary> {
    const profile = await this.prisma.coachProfile.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        bio: input.bio ?? null,
        experience: input.experience ?? null,
        hourlyRate: input.hourlyRate.toFixed(2),
      },
      update: {
        bio: input.bio ?? null,
        experience: input.experience ?? null,
        hourlyRate: input.hourlyRate.toFixed(2),
      },
    });
    return toCoachProfileSummary(profile);
  }

  async findProfileByUserId(userId: string): Promise<CoachProfileSummary | null> {
    const profile = await this.prisma.coachProfile.findUnique({ where: { userId } });
    return profile ? toCoachProfileSummary(profile) : null;
  }

  async findProfileById(id: string): Promise<CoachProfileSummary | null> {
    const profile = await this.prisma.coachProfile.findUnique({ where: { id } });
    return profile ? toCoachProfileSummary(profile) : null;
  }

  async listPublicProfiles(filters: CoachProfileFilters): Promise<CoachProfileSummary[]> {
    const where: Prisma.CoachProfileWhereInput = { active: true };
    if (filters.verifiedOnly) where.verificationStatus = "VERIFIED";
    const profiles = await this.prisma.coachProfile.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: filters.limit ?? 50,
    });
    return profiles.map(toCoachProfileSummary);
  }

  async setVerification(
    coachId: string,
    status: CoachVerificationStatus,
  ): Promise<CoachProfileSummary> {
    const profile = await this.prisma.coachProfile.update({
      where: { id: coachId },
      data: { verificationStatus: status },
    });
    return toCoachProfileSummary(profile);
  }

  async addAvailability(input: AddAvailabilityInput): Promise<AvailabilitySummary> {
    const slot = await this.prisma.coachAvailability.create({
      data: {
        coachId: input.coachId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        location: input.location,
      },
    });
    return toAvailabilitySummary(slot);
  }

  async listAvailability(coachId: string): Promise<AvailabilitySummary[]> {
    const slots = await this.prisma.coachAvailability.findMany({
      where: { coachId, active: true },
      orderBy: { startsAt: "asc" },
    });
    return slots.map(toAvailabilitySummary);
  }
}
