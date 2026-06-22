export type ModerationSubjectType = "VENUE" | "COACH" | "USER" | "REVIEW";
export type ModerationStatus = "OPEN" | "IN_REVIEW" | "RESOLVED" | "DISMISSED";

export interface ModerationCaseRecord {
  id: string;
  reporterId: string;
  subjectType: string;
  subjectId: string;
  reason: string;
  status: ModerationStatus;
  resolution: string | null;
  createdAt: Date;
}

export interface AuditEventInput {
  actorId: string;
  action: string;
  subjectType: string;
  subjectId: string;
  metadata?: Record<string, unknown>;
}

export interface ModerationRepository {
  subjectExists(type: ModerationSubjectType, id: string): Promise<boolean>;
  createCase(input: {
    reporterId: string;
    subjectType: ModerationSubjectType;
    subjectId: string;
    reason: string;
  }): Promise<ModerationCaseRecord>;
  listCases(status: ModerationStatus | undefined, limit: number): Promise<ModerationCaseRecord[]>;
  getCase(id: string): Promise<ModerationCaseRecord | null>;
  resolveCase(input: {
    id: string;
    status: "RESOLVED" | "DISMISSED";
    resolution: string;
  }): Promise<ModerationCaseRecord>;
  setSubjectSuspended(type: ModerationSubjectType, id: string, suspended: boolean): Promise<void>;
  recordAudit(input: AuditEventInput): Promise<void>;
}

export class ModerationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "ModerationError";
  }
}

const SUBJECT_TYPES: ModerationSubjectType[] = ["VENUE", "COACH", "USER", "REVIEW"];

// REVIEW subjects can be reported but not suspended/reinstated as an account.
const SUSPENDABLE: ModerationSubjectType[] = ["VENUE", "COACH", "USER"];

export function assertSubjectType(value: string): ModerationSubjectType {
  if (!SUBJECT_TYPES.includes(value as ModerationSubjectType)) {
    throw new ModerationError("MODERATION_SUBJECT_INVALID", "Unknown subject type");
  }
  return value as ModerationSubjectType;
}

export class ModerationService {
  constructor(private readonly repository: ModerationRepository) {}

  async report(input: {
    reporterId: string;
    subjectType: string;
    subjectId: string;
    reason: string;
  }): Promise<ModerationCaseRecord> {
    const subjectType = assertSubjectType(input.subjectType);
    const reason = input.reason.trim();
    if (reason.length < 4) {
      throw new ModerationError("MODERATION_REASON_REQUIRED", "Describe the problem");
    }
    if (subjectType !== "REVIEW") {
      const exists = await this.repository.subjectExists(subjectType, input.subjectId);
      if (!exists) throw new ModerationError("MODERATION_SUBJECT_NOT_FOUND", "Subject not found");
    }
    return this.repository.createCase({
      reporterId: input.reporterId,
      subjectType,
      subjectId: input.subjectId,
      reason,
    });
  }

  listOpenCases(limit = 100): Promise<ModerationCaseRecord[]> {
    return this.repository.listCases(undefined, limit);
  }

  listCasesByStatus(status: ModerationStatus, limit = 100): Promise<ModerationCaseRecord[]> {
    return this.repository.listCases(status, limit);
  }

  async resolveCase(input: {
    caseId: string;
    actorId: string;
    status: "RESOLVED" | "DISMISSED";
    resolution: string;
  }): Promise<ModerationCaseRecord> {
    const existing = await this.repository.getCase(input.caseId);
    if (!existing) throw new ModerationError("MODERATION_CASE_NOT_FOUND", "Case not found");
    if (existing.status === "RESOLVED" || existing.status === "DISMISSED") {
      throw new ModerationError("MODERATION_CASE_CLOSED", `Case is already ${existing.status}`);
    }
    const resolved = await this.repository.resolveCase({
      id: input.caseId,
      status: input.status,
      resolution: input.resolution.trim(),
    });
    await this.repository.recordAudit({
      actorId: input.actorId,
      action: input.status === "RESOLVED" ? "MODERATION_RESOLVED" : "MODERATION_DISMISSED",
      subjectType: existing.subjectType,
      subjectId: existing.subjectId,
      metadata: { caseId: input.caseId },
    });
    return resolved;
  }

  async setSuspension(input: {
    actorId: string;
    subjectType: string;
    subjectId: string;
    suspended: boolean;
  }): Promise<void> {
    const subjectType = assertSubjectType(input.subjectType);
    if (!SUSPENDABLE.includes(subjectType)) {
      throw new ModerationError("MODERATION_NOT_SUSPENDABLE", "This subject cannot be suspended");
    }
    const exists = await this.repository.subjectExists(subjectType, input.subjectId);
    if (!exists) throw new ModerationError("MODERATION_SUBJECT_NOT_FOUND", "Subject not found");
    await this.repository.setSubjectSuspended(subjectType, input.subjectId, input.suspended);
    await this.repository.recordAudit({
      actorId: input.actorId,
      action: input.suspended ? "SUBJECT_SUSPENDED" : "SUBJECT_REINSTATED",
      subjectType,
      subjectId: input.subjectId,
    });
  }
}
