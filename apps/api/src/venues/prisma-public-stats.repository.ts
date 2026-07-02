import type { PrismaClient } from "@courtlink/database";
import type { PublicStats, PublicStatsRepository } from "./public-stats.service.js";

export class PrismaPublicStatsRepository implements PublicStatsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async counts(): Promise<PublicStats> {
    const [venues, cities, coaches] = await Promise.all([
      this.prisma.venue.count({ where: { status: "APPROVED" } }),
      this.prisma.venue
        .groupBy({ by: ["cityMunicipality"], where: { status: "APPROVED" } })
        .then((groups) => groups.length),
      this.prisma.coachProfile.count({ where: { active: true } }),
    ]);
    return { venues, cities, coaches };
  }
}
