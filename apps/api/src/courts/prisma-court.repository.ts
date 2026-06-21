import type { PrismaClient } from "@courtlink/database";
import {
  type CourtRepository,
  type CourtSummary,
  type CreateCourtInput,
  type PricingRule,
  toCourtSummary,
  toPricingRule,
} from "./court.service.js";

export class PrismaCourtRepository implements CourtRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createCourt(input: CreateCourtInput): Promise<CourtSummary> {
    const court = await this.prisma.court.create({
      data: {
        venueId: input.venueId,
        name: input.name,
        description: input.description ?? null,
        indoor: input.indoor ?? false,
        slotIncrementMin: input.slotIncrementMin ?? 30,
        minimumDurationMin: input.minimumDurationMin ?? 60,
        maximumDurationMin: input.maximumDurationMin ?? 240,
      },
    });
    return toCourtSummary(court);
  }

  async listCourtsForVenue(venueId: string): Promise<CourtSummary[]> {
    const courts = await this.prisma.court.findMany({
      where: { venueId },
      orderBy: { name: "asc" },
    });
    return courts.map(toCourtSummary);
  }

  async findCourtById(id: string): Promise<CourtSummary | null> {
    const court = await this.prisma.court.findUnique({ where: { id } });
    return court ? toCourtSummary(court) : null;
  }

  async listPricingRules(courtId: string): Promise<PricingRule[]> {
    const rules = await this.prisma.courtPricingRule.findMany({ where: { courtId } });
    return rules.map(toPricingRule);
  }
}
