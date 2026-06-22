import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { EmailSender } from "../notifications/notification.service.js";

export type OrgRole = "OWNER" | "MANAGER" | "STAFF";
export type MembershipStatus = "ACTIVE" | "SUSPENDED";
export type InvitationStatus = "PENDING" | "ACCEPTED" | "REVOKED";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type OrganizationStaffErrorCode =
  | "INVALID_INVITE_ROLE"
  | "INSUFFICIENT_ROLE"
  | "ALREADY_MEMBER"
  | "INVITATION_TOKEN_INVALID"
  | "INVITATION_EMAIL_MISMATCH"
  | "MEMBER_NOT_FOUND"
  | "LAST_OWNER_PROTECTED"
  | "INVITATION_NOT_FOUND";

export class OrganizationStaffError extends Error {
  constructor(
    readonly code: OrganizationStaffErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "OrganizationStaffError";
  }
}

export interface MemberRecord {
  businessId: string;
  userId: string;
  email: string;
  role: OrgRole;
  status: MembershipStatus;
}

export interface InvitationRecord {
  id: string;
  email: string;
  role: OrgRole;
  status: InvitationStatus;
  expiresAt: Date;
  acceptedById?: string | null;
}

export interface AuditEventInput {
  actorId: string;
  businessId: string;
  action: string;
  subjectType: string;
  subjectId: string;
  metadata?: Record<string, unknown>;
}

export interface AuditEventView {
  id: string;
  actorId: string | null;
  action: string;
  subjectType: string;
  subjectId: string;
  metadata: Record<string, unknown> | null;
  occurredAt: Date;
}

export interface Actor {
  id: string;
  role: OrgRole;
}

export interface OrganizationStaffRepository {
  findMembership(businessId: string, userId: string): Promise<MemberRecord | null>;
  findActiveMemberByEmail(businessId: string, email: string): Promise<MemberRecord | null>;
  countActiveOwners(businessId: string): Promise<number>;
  upsertMembership(businessId: string, userId: string, email: string, role: OrgRole): Promise<void>;
  setMembershipStatus(businessId: string, userId: string, status: MembershipStatus): Promise<void>;
  removeMembership(businessId: string, userId: string): Promise<void>;
  listMembers(businessId: string): Promise<MemberRecord[]>;
  findPendingInvitationByEmail(businessId: string, email: string): Promise<InvitationRecord | null>;
  revokePendingInvitations(businessId: string, email: string): Promise<void>;
  createInvitation(input: {
    id: string;
    businessId: string;
    email: string;
    role: OrgRole;
    tokenHash: string;
    invitedById: string;
    expiresAt: Date;
  }): Promise<void>;
  findInvitationByTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<(InvitationRecord & { businessId: string }) | null>;
  markInvitationAccepted(id: string, userId: string): Promise<void>;
  revokeInvitation(businessId: string, id: string): Promise<boolean>;
  listInvitations(businessId: string): Promise<InvitationRecord[]>;
  recordAudit(input: AuditEventInput): Promise<void>;
  listAuditEvents(businessId: string, limit: number): Promise<AuditEventView[]>;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class OrganizationStaffService {
  constructor(
    private readonly repository: OrganizationStaffRepository,
    private readonly email: EmailSender,
    private readonly appBaseUrl: string,
  ) {}

  async inviteStaff(
    input: { businessId: string; email: string; role: OrgRole },
    actor: Actor,
    now: Date = new Date(),
  ): Promise<string> {
    if (input.role === "OWNER") {
      throw new OrganizationStaffError("INVALID_INVITE_ROLE", "Owners cannot be invited");
    }
    if (input.role === "MANAGER" && actor.role !== "OWNER") {
      throw new OrganizationStaffError("INSUFFICIENT_ROLE", "Only an owner can invite a manager");
    }
    const email = normalizeEmail(input.email);
    const existingMember = await this.repository.findActiveMemberByEmail(input.businessId, email);
    if (existingMember) {
      throw new OrganizationStaffError("ALREADY_MEMBER", "That person is already a member");
    }
    await this.repository.revokePendingInvitations(input.businessId, email);

    const token = randomBytes(32).toString("base64url");
    const id = randomUUID();
    await this.repository.createInvitation({
      id,
      businessId: input.businessId,
      email,
      role: input.role,
      tokenHash: hashToken(token),
      invitedById: actor.id,
      expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
    });
    const link = `${this.appBaseUrl}/invitations/accept?token=${token}`;
    await this.email.send({
      to: email,
      subject: "You are invited to a CourtLink PH organization",
      text: `You have been invited as ${input.role}. Accept your invitation: ${link}`,
    });
    await this.repository.recordAudit({
      actorId: actor.id,
      businessId: input.businessId,
      action: "ORG_STAFF_INVITED",
      subjectType: "StaffInvitation",
      subjectId: id,
      metadata: { role: input.role },
    });
    return token;
  }

  async acceptInvitation(
    token: string,
    user: { id: string; email: string },
    now: Date = new Date(),
  ): Promise<{ businessId: string; role: OrgRole }> {
    const invitation = await this.repository.findInvitationByTokenHash(hashToken(token), now);
    if (!invitation) {
      throw new OrganizationStaffError(
        "INVITATION_TOKEN_INVALID",
        "Invitation is invalid or has expired",
      );
    }
    if (normalizeEmail(user.email) !== invitation.email) {
      throw new OrganizationStaffError(
        "INVITATION_EMAIL_MISMATCH",
        "This invitation was sent to a different email address",
      );
    }
    await this.repository.upsertMembership(
      invitation.businessId,
      user.id,
      invitation.email,
      invitation.role,
    );
    await this.repository.markInvitationAccepted(invitation.id, user.id);
    await this.repository.recordAudit({
      actorId: user.id,
      businessId: invitation.businessId,
      action: "ORG_STAFF_JOINED",
      subjectType: "BusinessMembership",
      subjectId: user.id,
      metadata: { role: invitation.role },
    });
    return { businessId: invitation.businessId, role: invitation.role };
  }

  async revokeInvitation(businessId: string, invitationId: string, actor: Actor): Promise<void> {
    const revoked = await this.repository.revokeInvitation(businessId, invitationId);
    if (!revoked) {
      throw new OrganizationStaffError("INVITATION_NOT_FOUND", "Invitation not found");
    }
    await this.repository.recordAudit({
      actorId: actor.id,
      businessId,
      action: "ORG_STAFF_INVITE_REVOKED",
      subjectType: "StaffInvitation",
      subjectId: invitationId,
    });
  }

  listInvitations(businessId: string): Promise<InvitationRecord[]> {
    return this.repository.listInvitations(businessId);
  }

  listMembers(businessId: string): Promise<MemberRecord[]> {
    return this.repository.listMembers(businessId);
  }

  listAuditEvents(businessId: string, limit = 100): Promise<AuditEventView[]> {
    return this.repository.listAuditEvents(businessId, limit);
  }

  async suspendMembership(businessId: string, targetUserId: string, actor: Actor): Promise<void> {
    const target = await this.requireManageableTarget(businessId, targetUserId, actor);
    if (target.role === "OWNER") {
      await this.assertNotLastOwner(businessId);
    }
    await this.repository.setMembershipStatus(businessId, targetUserId, "SUSPENDED");
    await this.repository.recordAudit({
      actorId: actor.id,
      businessId,
      action: "ORG_MEMBER_SUSPENDED",
      subjectType: "BusinessMembership",
      subjectId: targetUserId,
    });
  }

  async reinstateMembership(businessId: string, targetUserId: string, actor: Actor): Promise<void> {
    await this.requireManageableTarget(businessId, targetUserId, actor);
    await this.repository.setMembershipStatus(businessId, targetUserId, "ACTIVE");
    await this.repository.recordAudit({
      actorId: actor.id,
      businessId,
      action: "ORG_MEMBER_REINSTATED",
      subjectType: "BusinessMembership",
      subjectId: targetUserId,
    });
  }

  async removeMembership(businessId: string, targetUserId: string, actor: Actor): Promise<void> {
    const target = await this.requireManageableTarget(businessId, targetUserId, actor);
    if (target.role === "OWNER") {
      await this.assertNotLastOwner(businessId);
    }
    await this.repository.removeMembership(businessId, targetUserId);
    await this.repository.recordAudit({
      actorId: actor.id,
      businessId,
      action: "ORG_MEMBER_REMOVED",
      subjectType: "BusinessMembership",
      subjectId: targetUserId,
    });
  }

  private async requireManageableTarget(
    businessId: string,
    targetUserId: string,
    actor: Actor,
  ): Promise<MemberRecord> {
    const target = await this.repository.findMembership(businessId, targetUserId);
    if (!target) throw new OrganizationStaffError("MEMBER_NOT_FOUND", "Member not found");
    if (target.role === "OWNER" && actor.role !== "OWNER") {
      throw new OrganizationStaffError("INSUFFICIENT_ROLE", "Only an owner can manage an owner");
    }
    if (target.role === "MANAGER" && actor.role !== "OWNER") {
      throw new OrganizationStaffError("INSUFFICIENT_ROLE", "Only an owner can manage a manager");
    }
    return target;
  }

  private async assertNotLastOwner(businessId: string): Promise<void> {
    const owners = await this.repository.countActiveOwners(businessId);
    if (owners <= 1) {
      throw new OrganizationStaffError(
        "LAST_OWNER_PROTECTED",
        "The last active owner cannot be removed or suspended",
      );
    }
  }
}
