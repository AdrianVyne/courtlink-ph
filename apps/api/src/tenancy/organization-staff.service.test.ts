import { describe, expect, it } from "vitest";
import {
  OrganizationStaffError,
  OrganizationStaffService,
  type AuditEventInput,
  type InvitationRecord,
  type MemberRecord,
  type OrganizationStaffRepository,
} from "./organization-staff.service.js";
import type { EmailMessage, EmailSender } from "../notifications/notification.service.js";

class InMemoryRepo implements OrganizationStaffRepository {
  members: MemberRecord[] = [];
  invitations: (InvitationRecord & { tokenHash: string; businessId: string })[] = [];
  audits: AuditEventInput[] = [];

  async findMembership(businessId: string, userId: string): Promise<MemberRecord | null> {
    return this.members.find((m) => m.businessId === businessId && m.userId === userId) ?? null;
  }
  async findActiveMemberByEmail(businessId: string, email: string): Promise<MemberRecord | null> {
    return (
      this.members.find(
        (m) => m.businessId === businessId && m.email === email && m.status === "ACTIVE",
      ) ?? null
    );
  }
  async countActiveOwners(businessId: string): Promise<number> {
    return this.members.filter(
      (m) => m.businessId === businessId && m.role === "OWNER" && m.status === "ACTIVE",
    ).length;
  }
  async upsertMembership(
    businessId: string,
    userId: string,
    email: string,
    role: "OWNER" | "MANAGER" | "STAFF",
  ): Promise<void> {
    const existing = this.members.find((m) => m.businessId === businessId && m.userId === userId);
    if (existing) {
      existing.role = role;
      existing.status = "ACTIVE";
    } else {
      this.members.push({ businessId, userId, email, role, status: "ACTIVE" });
    }
  }
  async setMembershipStatus(
    businessId: string,
    userId: string,
    status: "ACTIVE" | "SUSPENDED",
  ): Promise<void> {
    const m = this.members.find((x) => x.businessId === businessId && x.userId === userId);
    if (m) m.status = status;
  }
  async removeMembership(businessId: string, userId: string): Promise<void> {
    this.members = this.members.filter(
      (m) => !(m.businessId === businessId && m.userId === userId),
    );
  }
  async listMembers(businessId: string): Promise<MemberRecord[]> {
    return this.members.filter((m) => m.businessId === businessId);
  }
  async findPendingInvitationByEmail(
    businessId: string,
    email: string,
  ): Promise<InvitationRecord | null> {
    return (
      this.invitations.find(
        (i) => i.businessId === businessId && i.email === email && i.status === "PENDING",
      ) ?? null
    );
  }
  async revokePendingInvitations(businessId: string, email: string): Promise<void> {
    for (const i of this.invitations) {
      if (i.businessId === businessId && i.email === email && i.status === "PENDING") {
        i.status = "REVOKED";
      }
    }
  }
  async createInvitation(input: {
    id: string;
    businessId: string;
    email: string;
    role: "OWNER" | "MANAGER" | "STAFF";
    tokenHash: string;
    invitedById: string;
    expiresAt: Date;
  }): Promise<void> {
    this.invitations.push({
      id: input.id,
      businessId: input.businessId,
      email: input.email,
      role: input.role,
      status: "PENDING",
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
    });
  }
  async findInvitationByTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<(InvitationRecord & { businessId: string }) | null> {
    const row = this.invitations.find(
      (i) => i.tokenHash === tokenHash && i.status === "PENDING" && i.expiresAt > now,
    );
    return row ?? null;
  }
  async markInvitationAccepted(id: string, userId: string): Promise<void> {
    const i = this.invitations.find((x) => x.id === id);
    if (i) {
      i.status = "ACCEPTED";
      i.acceptedById = userId;
    }
  }
  async revokeInvitation(businessId: string, id: string): Promise<boolean> {
    const i = this.invitations.find(
      (x) => x.id === id && x.businessId === businessId && x.status === "PENDING",
    );
    if (!i) return false;
    i.status = "REVOKED";
    return true;
  }
  async listInvitations(businessId: string): Promise<InvitationRecord[]> {
    return this.invitations.filter((i) => i.businessId === businessId && i.status === "PENDING");
  }
  async recordAudit(input: AuditEventInput): Promise<void> {
    this.audits.push(input);
  }
  async listAuditEvents(businessId: string): Promise<never[]> {
    void businessId;
    return [];
  }
}

class FakeEmail implements EmailSender {
  sent: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}

function build() {
  const repo = new InMemoryRepo();
  const email = new FakeEmail();
  const service = new OrganizationStaffService(repo, email, "https://app.test");
  return { repo, email, service };
}

const biz = "biz-1";
const owner = { id: "owner-1", role: "OWNER" as const };
const now = new Date("2026-06-22T00:00:00.000Z");

describe("staff invitations", () => {
  it("an owner can invite a manager and an email is sent", async () => {
    const { repo, email, service } = build();
    repo.members.push({
      businessId: biz,
      userId: owner.id,
      email: "owner@test",
      role: "OWNER",
      status: "ACTIVE",
    });

    await service.inviteStaff(
      { businessId: biz, email: "Manager@Test", role: "MANAGER" },
      owner,
      now,
    );

    expect(repo.invitations).toHaveLength(1);
    expect(repo.invitations[0]?.email).toBe("manager@test");
    expect(email.sent[0]?.text).toContain("https://app.test/invitations/accept?token=");
    expect(repo.audits.some((a) => a.action === "ORG_STAFF_INVITED")).toBe(true);
  });

  it("a manager cannot invite a manager or owner", async () => {
    const { service } = build();
    await expect(
      service.inviteStaff(
        { businessId: biz, email: "x@test", role: "MANAGER" },
        { id: "mgr", role: "MANAGER" },
        now,
      ),
    ).rejects.toBeInstanceOf(OrganizationStaffError);
  });

  it("rejects inviting an existing active member", async () => {
    const { repo, service } = build();
    repo.members.push({
      businessId: biz,
      userId: "u2",
      email: "member@test",
      role: "STAFF",
      status: "ACTIVE",
    });
    await expect(
      service.inviteStaff({ businessId: biz, email: "member@test", role: "STAFF" }, owner, now),
    ).rejects.toMatchObject({ code: "ALREADY_MEMBER" });
  });

  it("accepts a valid invitation for the matching user and creates an active membership", async () => {
    const { repo, service } = build();
    repo.members.push({
      businessId: biz,
      userId: owner.id,
      email: "owner@test",
      role: "OWNER",
      status: "ACTIVE",
    });
    const token = await service.inviteStaff(
      { businessId: biz, email: "new@test", role: "STAFF" },
      owner,
      now,
    );

    await service.acceptInvitation(token, { id: "new-user", email: "new@test" }, now);

    const member = repo.members.find((m) => m.userId === "new-user");
    expect(member?.role).toBe("STAFF");
    expect(member?.status).toBe("ACTIVE");
    expect(repo.invitations[0]?.status).toBe("ACCEPTED");
  });

  it("rejects acceptance by a mismatched email", async () => {
    const { service } = build();
    const token = await service.inviteStaff(
      { businessId: biz, email: "new@test", role: "STAFF" },
      owner,
      now,
    );
    await expect(
      service.acceptInvitation(token, { id: "other", email: "other@test" }, now),
    ).rejects.toMatchObject({ code: "INVITATION_EMAIL_MISMATCH" });
  });

  it("rejects an expired invitation", async () => {
    const { service } = build();
    const token = await service.inviteStaff(
      { businessId: biz, email: "new@test", role: "STAFF" },
      owner,
      now,
    );
    const later = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);
    await expect(
      service.acceptInvitation(token, { id: "new-user", email: "new@test" }, later),
    ).rejects.toMatchObject({ code: "INVITATION_TOKEN_INVALID" });
  });
});

describe("membership management", () => {
  function seedOwnerAndStaff(repo: InMemoryRepo) {
    repo.members.push({
      businessId: biz,
      userId: owner.id,
      email: "owner@test",
      role: "OWNER",
      status: "ACTIVE",
    });
    repo.members.push({
      businessId: biz,
      userId: "staff-1",
      email: "staff@test",
      role: "STAFF",
      status: "ACTIVE",
    });
  }

  it("an owner can suspend and reinstate a staff member", async () => {
    const { repo, service } = build();
    seedOwnerAndStaff(repo);

    await service.suspendMembership(biz, "staff-1", owner);
    expect(repo.members.find((m) => m.userId === "staff-1")?.status).toBe("SUSPENDED");

    await service.reinstateMembership(biz, "staff-1", owner);
    expect(repo.members.find((m) => m.userId === "staff-1")?.status).toBe("ACTIVE");
    expect(repo.audits.some((a) => a.action === "ORG_MEMBER_SUSPENDED")).toBe(true);
    expect(repo.audits.some((a) => a.action === "ORG_MEMBER_REINSTATED")).toBe(true);
  });

  it("an owner can remove a staff member", async () => {
    const { repo, service } = build();
    seedOwnerAndStaff(repo);
    await service.removeMembership(biz, "staff-1", owner);
    expect(repo.members.find((m) => m.userId === "staff-1")).toBeUndefined();
  });

  it("cannot remove the last active owner", async () => {
    const { repo, service } = build();
    seedOwnerAndStaff(repo);
    await expect(service.removeMembership(biz, owner.id, owner)).rejects.toMatchObject({
      code: "LAST_OWNER_PROTECTED",
    });
  });

  it("cannot suspend the last active owner", async () => {
    const { repo, service } = build();
    seedOwnerAndStaff(repo);
    await expect(service.suspendMembership(biz, owner.id, owner)).rejects.toMatchObject({
      code: "LAST_OWNER_PROTECTED",
    });
  });

  it("a manager cannot remove an owner", async () => {
    const { repo, service } = build();
    seedOwnerAndStaff(repo);
    await expect(
      service.removeMembership(biz, owner.id, { id: "mgr", role: "MANAGER" }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_ROLE" });
  });
});
