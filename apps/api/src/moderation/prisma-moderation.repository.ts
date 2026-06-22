import { type Prisma, type PrismaClient, UserStatus, VenueStatus } from "@courtlink/database";
import type {
  AuditEventInput,
  ModerationCaseRecord,
  ModerationRepository,
  ModerationStatus,
  ModerationSubjectType,
} from "./moderation.service.js";

type CaseRow = {
  id: string;
  reporterId: string;
  subjectType: string;
  subjectId: string;
  reason: string;
  status: string;
  resolution: string | null;
  createdAt: Date;
};

function toCase(row: CaseRow): ModerationCaseRecord {
  return {
    id: row.id,
    reporterId: row.reporterId,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    reason: row.reason,
    status: row.status as ModerationStatus,
    resolution: row.resolution,
    createdAt: row.createdAt,
  };
}

export class PrismaModerationRepository implements ModerationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async subjectExists(type: ModerationSubjectType, id: string): Promise<boolean> {
    if (type === "VENUE") return (await this.prisma.venue.count({ where: { id } })) > 0;
    if (type === "COACH") return (await this.prisma.coachProfile.count({ where: { id } })) > 0;
    if (type === "USER") return (await this.prisma.user.count({ where: { id } })) > 0;
    return true;
  }

  async createCase(input: {
    reporterId: string;
    subjectType: ModerationSubjectType;
    subjectId: string;
    reason: string;
  }): Promise<ModerationCaseRecord> {
    const created = await this.prisma.moderationCase.create({
      data: {
        reporterId: input.reporterId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        reason: input.reason,
      },
    });
    return toCase(created);
  }

  async listCases(
    status: ModerationStatus | undefined,
    limit: number,
  ): Promise<ModerationCaseRecord[]> {
    const rows = await this.prisma.moderationCase.findMany({
      where: status ? { status } : { status: { in: ["OPEN", "IN_REVIEW"] } },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    return rows.map(toCase);
  }

  async getCase(id: string): Promise<ModerationCaseRecord | null> {
    const row = await this.prisma.moderationCase.findUnique({ where: { id } });
    return row ? toCase(row) : null;
  }

  async resolveCase(input: {
    id: string;
    status: "RESOLVED" | "DISMISSED";
    resolution: string;
  }): Promise<ModerationCaseRecord> {
    const row = await this.prisma.moderationCase.update({
      where: { id: input.id },
      data: { status: input.status, resolution: input.resolution },
    });
    return toCase(row);
  }

  async setSubjectSuspended(
    type: ModerationSubjectType,
    id: string,
    suspended: boolean,
  ): Promise<void> {
    if (type === "VENUE") {
      await this.prisma.venue.update({
        where: { id },
        data: { status: suspended ? VenueStatus.SUSPENDED : VenueStatus.APPROVED },
      });
      return;
    }
    if (type === "COACH") {
      await this.prisma.coachProfile.update({ where: { id }, data: { active: !suspended } });
      return;
    }
    if (type === "USER") {
      await this.prisma.user.update({
        where: { id },
        data: { status: suspended ? UserStatus.SUSPENDED : UserStatus.ACTIVE },
      });
      // Suspending a user invalidates active sessions immediately.
      if (suspended) await this.prisma.session.deleteMany({ where: { userId: id } });
    }
  }

  async recordAudit(input: AuditEventInput): Promise<void> {
    const data: Prisma.AuditEventCreateInput = {
      actor: { connect: { id: input.actorId } },
      action: input.action,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
    };
    if (input.metadata) data.metadata = input.metadata as Prisma.InputJsonValue;
    await this.prisma.auditEvent.create({ data });
  }
}
