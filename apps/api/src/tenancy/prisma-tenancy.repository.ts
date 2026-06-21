import { OrganizationRole, type PrismaClient } from "@courtlink/database";
import type {
  BusinessSummary,
  CreateBusinessInput,
  MembershipSummary,
  TenancyRepository,
} from "./tenancy.service.js";

function toSummary(business: {
  id: string;
  name: string;
  legalName: string | null;
  createdAt: Date;
}): BusinessSummary {
  return {
    id: business.id,
    name: business.name,
    legalName: business.legalName ?? null,
    createdAt: business.createdAt,
  };
}

export class PrismaTenancyRepository implements TenancyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createBusinessWithOwner(
    input: CreateBusinessInput,
    userId: string,
  ): Promise<BusinessSummary> {
    const business = await this.prisma.business.create({
      data: {
        name: input.name,
        legalName: input.legalName ?? null,
        memberships: {
          create: { userId, role: OrganizationRole.OWNER },
        },
      },
    });
    return toSummary(business);
  }

  async listMembershipsForUser(userId: string): Promise<MembershipSummary[]> {
    const rows = await this.prisma.businessMembership.findMany({
      where: { userId },
      include: { business: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => ({
      businessId: row.businessId,
      role: row.role,
      business: toSummary(row.business),
    }));
  }

  async listMemberUserIds(businessId: string): Promise<string[]> {
    const rows = await this.prisma.businessMembership.findMany({
      where: { businessId },
      select: { userId: true },
    });
    return rows.map((row) => row.userId);
  }

  async findMembership(userId: string, businessId: string): Promise<MembershipSummary | null> {
    const row = await this.prisma.businessMembership.findUnique({
      where: { businessId_userId: { businessId, userId } },
      include: { business: true },
    });
    if (!row) return null;
    return {
      businessId: row.businessId,
      role: row.role,
      business: toSummary(row.business),
    };
  }
}
