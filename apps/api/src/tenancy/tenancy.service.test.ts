import type { OrganizationRole } from "@courtlink/database";
import { describe, expect, it } from "vitest";
import {
  type BusinessSummary,
  ForbiddenTenantError,
  type MembershipSummary,
  type TenancyRepository,
  TenancyService,
} from "./tenancy.service.js";

class InMemoryTenancyRepository implements TenancyRepository {
  readonly memberships: MembershipSummary[] = [];
  readonly businesses: BusinessSummary[] = [];

  async createBusinessWithOwner(
    input: { name: string; legalName: string | null },
    userId: string,
  ): Promise<BusinessSummary> {
    const business: BusinessSummary = {
      id: `business-${this.businesses.length + 1}`,
      name: input.name,
      legalName: input.legalName,
      createdAt: new Date("2026-06-21T00:00:00.000Z"),
    };
    this.businesses.push(business);
    this.memberships.push({ businessId: business.id, role: "OWNER", status: "ACTIVE", business });
    void userId;
    return business;
  }

  async listMembershipsForUser(_userId: string): Promise<MembershipSummary[]> {
    return [...this.memberships];
  }

  async listMemberUserIds(_businessId: string): Promise<string[]> {
    return [];
  }

  async findMembership(_userId: string, businessId: string): Promise<MembershipSummary | null> {
    return this.memberships.find((m) => m.businessId === businessId) ?? null;
  }
}

describe("TenancyService", () => {
  it("creates a business and makes the creator OWNER", async () => {
    const repository = new InMemoryTenancyRepository();
    const service = new TenancyService(repository);

    const business = await service.createBusiness({ name: "  Pickleball Pros  " }, "user-1");

    expect(business.name).toBe("Pickleball Pros");
    expect(repository.memberships).toEqual([
      expect.objectContaining({ businessId: business.id, role: "OWNER" }),
    ]);
  });

  it("rejects business names shorter than two characters", async () => {
    const service = new TenancyService(new InMemoryTenancyRepository());
    await expect(service.createBusiness({ name: " a " }, "user-1")).rejects.toThrow(
      "BUSINESS_NAME_TOO_SHORT",
    );
  });

  it("returns forbidden when the membership role is not allowed", async () => {
    const repository = new InMemoryTenancyRepository();
    repository.memberships.push({
      businessId: "business-1",
      role: "STAFF" as OrganizationRole,
      status: "ACTIVE" as const,
      business: {
        id: "business-1",
        name: "Other",
        legalName: null,
        createdAt: new Date(),
      },
    });
    const service = new TenancyService(repository);

    await expect(service.assertRole("user-1", "business-1", ["OWNER"])).rejects.toBeInstanceOf(
      ForbiddenTenantError,
    );
    await expect(service.assertRole("user-1", "business-1", ["STAFF"])).resolves.toBeDefined();
  });
});
