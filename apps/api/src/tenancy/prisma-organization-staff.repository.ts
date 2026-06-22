import type { Prisma, PrismaClient } from "@courtlink/database";
import type {
  AuditEventInput,
  AuditEventView,
  InvitationRecord,
  MemberRecord,
  OrganizationStaffRepository,
  OrgRole,
} from "./organization-staff.service.js";

export class PrismaOrganizationStaffRepository implements OrganizationStaffRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findMembership(businessId: string, userId: string): Promise<MemberRecord | null> {
    const row = await this.prisma.businessMembership.findUnique({
      where: { businessId_userId: { businessId, userId } },
      include: { user: { select: { email: true } } },
    });
    if (!row) return null;
    return {
      businessId: row.businessId,
      userId: row.userId,
      email: row.user.email,
      role: row.role,
      status: row.status,
    };
  }

  async findActiveMemberByEmail(businessId: string, email: string): Promise<MemberRecord | null> {
    const row = await this.prisma.businessMembership.findFirst({
      where: { businessId, status: "ACTIVE", user: { email } },
      include: { user: { select: { email: true } } },
    });
    if (!row) return null;
    return {
      businessId: row.businessId,
      userId: row.userId,
      email: row.user.email,
      role: row.role,
      status: row.status,
    };
  }

  async countActiveOwners(businessId: string): Promise<number> {
    return this.prisma.businessMembership.count({
      where: { businessId, role: "OWNER", status: "ACTIVE" },
    });
  }

  async upsertMembership(
    businessId: string,
    userId: string,
    _email: string,
    role: OrgRole,
  ): Promise<void> {
    await this.prisma.businessMembership.upsert({
      where: { businessId_userId: { businessId, userId } },
      create: { businessId, userId, role, status: "ACTIVE" },
      update: { role, status: "ACTIVE" },
    });
  }

  async setMembershipStatus(
    businessId: string,
    userId: string,
    status: "ACTIVE" | "SUSPENDED",
  ): Promise<void> {
    await this.prisma.businessMembership.update({
      where: { businessId_userId: { businessId, userId } },
      data: { status },
    });
  }

  async removeMembership(businessId: string, userId: string): Promise<void> {
    await this.prisma.businessMembership.delete({
      where: { businessId_userId: { businessId, userId } },
    });
  }

  async listMembers(businessId: string): Promise<MemberRecord[]> {
    const rows = await this.prisma.businessMembership.findMany({
      where: { businessId },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => ({
      businessId: row.businessId,
      userId: row.userId,
      email: row.user.email,
      role: row.role,
      status: row.status,
    }));
  }

  async findPendingInvitationByEmail(
    businessId: string,
    email: string,
  ): Promise<InvitationRecord | null> {
    const row = await this.prisma.staffInvitation.findFirst({
      where: { businessId, email, status: "PENDING" },
    });
    return row ? toInvitation(row) : null;
  }

  async revokePendingInvitations(businessId: string, email: string): Promise<void> {
    await this.prisma.staffInvitation.updateMany({
      where: { businessId, email, status: "PENDING" },
      data: { status: "REVOKED" },
    });
  }

  async createInvitation(input: {
    id: string;
    businessId: string;
    email: string;
    role: OrgRole;
    tokenHash: string;
    invitedById: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.staffInvitation.create({
      data: {
        id: input.id,
        businessId: input.businessId,
        email: input.email,
        role: input.role,
        tokenHash: input.tokenHash,
        invitedById: input.invitedById,
        expiresAt: input.expiresAt,
      },
    });
  }

  async findInvitationByTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<(InvitationRecord & { businessId: string }) | null> {
    const row = await this.prisma.staffInvitation.findUnique({ where: { tokenHash } });
    if (!row || row.status !== "PENDING" || row.expiresAt <= now) return null;
    return { ...toInvitation(row), businessId: row.businessId };
  }

  async markInvitationAccepted(id: string, userId: string): Promise<void> {
    await this.prisma.staffInvitation.update({
      where: { id },
      data: { status: "ACCEPTED", acceptedById: userId },
    });
  }

  async revokeInvitation(businessId: string, id: string): Promise<boolean> {
    const result = await this.prisma.staffInvitation.updateMany({
      where: { id, businessId, status: "PENDING" },
      data: { status: "REVOKED" },
    });
    return result.count > 0;
  }

  async listInvitations(businessId: string): Promise<InvitationRecord[]> {
    const rows = await this.prisma.staffInvitation.findMany({
      where: { businessId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toInvitation);
  }

  async recordAudit(input: AuditEventInput): Promise<void> {
    const data: Prisma.AuditEventCreateInput = {
      actor: { connect: { id: input.actorId } },
      action: input.action,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      businessId: input.businessId,
    };
    if (input.metadata) data.metadata = input.metadata as Prisma.InputJsonValue;
    await this.prisma.auditEvent.create({ data });
  }

  async listAuditEvents(businessId: string, limit: number): Promise<AuditEventView[]> {
    const rows = await this.prisma.auditEvent.findMany({
      where: { businessId },
      orderBy: { occurredAt: "desc" },
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      actorId: row.actorId,
      action: row.action,
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      occurredAt: row.occurredAt,
    }));
  }
}

function toInvitation(row: {
  id: string;
  email: string;
  role: OrgRole;
  status: "PENDING" | "ACCEPTED" | "REVOKED";
  expiresAt: Date;
  acceptedById: string | null;
}): InvitationRecord {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    expiresAt: row.expiresAt,
    acceptedById: row.acceptedById,
  };
}
