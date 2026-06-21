import type { OrganizationRole } from "@courtlink/database";

export interface BusinessSummary {
  id: string;
  name: string;
  legalName: string | null;
  createdAt: Date;
}

export interface MembershipSummary {
  businessId: string;
  role: OrganizationRole;
  business: BusinessSummary;
}

export interface CreateBusinessInput {
  name: string;
  legalName?: string | null | undefined;
}

export interface TenancyRepository {
  createBusinessWithOwner(input: CreateBusinessInput, userId: string): Promise<BusinessSummary>;
  listMembershipsForUser(userId: string): Promise<MembershipSummary[]>;
  findMembership(userId: string, businessId: string): Promise<MembershipSummary | null>;
}

export class ForbiddenTenantError extends Error {
  readonly code = "TENANT_FORBIDDEN";

  constructor() {
    super("Not authorized for this business");
    this.name = "ForbiddenTenantError";
  }
}

export class TenancyService {
  constructor(private readonly repository: TenancyRepository) {}

  async createBusiness(input: CreateBusinessInput, userId: string): Promise<BusinessSummary> {
    const name = input.name.trim();
    if (name.length < 2) throw new Error("BUSINESS_NAME_TOO_SHORT");
    return this.repository.createBusinessWithOwner(
      { name, legalName: input.legalName?.trim() || null },
      userId,
    );
  }

  listMyMemberships(userId: string): Promise<MembershipSummary[]> {
    return this.repository.listMembershipsForUser(userId);
  }

  async assertRole(
    userId: string,
    businessId: string,
    allowed: OrganizationRole[],
  ): Promise<MembershipSummary> {
    const membership = await this.repository.findMembership(userId, businessId);
    if (!membership || !allowed.includes(membership.role)) {
      throw new ForbiddenTenantError();
    }
    return membership;
  }
}
