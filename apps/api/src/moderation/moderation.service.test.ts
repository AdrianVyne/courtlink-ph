import { describe, expect, it } from "vitest";
import {
  type AuditEventInput,
  type ModerationCaseRecord,
  ModerationError,
  type ModerationRepository,
  ModerationService,
  type ModerationStatus,
  type ModerationSubjectType,
} from "./moderation.service.js";

class FakeModerationRepo implements ModerationRepository {
  cases: ModerationCaseRecord[] = [];
  audits: AuditEventInput[] = [];
  suspended = new Map<string, boolean>();
  existing = new Set<string>(["VENUE:v1", "COACH:c1", "USER:u1"]);

  async subjectExists(type: ModerationSubjectType, id: string) {
    return this.existing.has(`${type}:${id}`);
  }
  async createCase(input: {
    reporterId: string;
    subjectType: ModerationSubjectType;
    subjectId: string;
    reason: string;
  }) {
    const c: ModerationCaseRecord = {
      id: `case-${this.cases.length + 1}`,
      reporterId: input.reporterId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      reason: input.reason,
      status: "OPEN",
      resolution: null,
      createdAt: new Date(),
    };
    this.cases.push(c);
    return c;
  }
  async listCases(status: ModerationStatus | undefined, limit: number) {
    return this.cases.filter((c) => !status || c.status === status).slice(0, limit);
  }
  async getCase(id: string) {
    return this.cases.find((c) => c.id === id) ?? null;
  }
  async resolveCase(input: { id: string; status: "RESOLVED" | "DISMISSED"; resolution: string }) {
    const c = this.cases.find((x) => x.id === input.id);
    if (!c) throw new ModerationError("MODERATION_CASE_NOT_FOUND", "missing");
    c.status = input.status;
    c.resolution = input.resolution;
    return c;
  }
  async setSubjectSuspended(type: ModerationSubjectType, id: string, suspended: boolean) {
    this.suspended.set(`${type}:${id}`, suspended);
  }
  async recordAudit(input: AuditEventInput) {
    this.audits.push(input);
  }
}

describe("ModerationService.report", () => {
  it("creates a case for an existing subject", async () => {
    const repo = new FakeModerationRepo();
    const service = new ModerationService(repo);
    const c = await service.report({
      reporterId: "r1",
      subjectType: "VENUE",
      subjectId: "v1",
      reason: "Fake listing",
    });
    expect(c.status).toBe("OPEN");
  });

  it("rejects unknown subject types and missing subjects", async () => {
    const service = new ModerationService(new FakeModerationRepo());
    await expect(
      service.report({ reporterId: "r1", subjectType: "PLANET", subjectId: "x", reason: "bad" }),
    ).rejects.toMatchObject({ code: "MODERATION_SUBJECT_INVALID" });
    await expect(
      service.report({
        reporterId: "r1",
        subjectType: "VENUE",
        subjectId: "missing",
        reason: "bad listing",
      }),
    ).rejects.toMatchObject({ code: "MODERATION_SUBJECT_NOT_FOUND" });
  });

  it("allows reporting reviews without an existence check", async () => {
    const service = new ModerationService(new FakeModerationRepo());
    const c = await service.report({
      reporterId: "r1",
      subjectType: "REVIEW",
      subjectId: "anything",
      reason: "Abusive language",
    });
    expect(c.subjectType).toBe("REVIEW");
  });

  it("requires a meaningful reason", async () => {
    const service = new ModerationService(new FakeModerationRepo());
    await expect(
      service.report({ reporterId: "r1", subjectType: "VENUE", subjectId: "v1", reason: " x " }),
    ).rejects.toMatchObject({ code: "MODERATION_REASON_REQUIRED" });
  });
});

describe("ModerationService.resolveCase", () => {
  it("resolves an open case and writes an audit event", async () => {
    const repo = new FakeModerationRepo();
    const service = new ModerationService(repo);
    const c = await service.report({
      reporterId: "r1",
      subjectType: "VENUE",
      subjectId: "v1",
      reason: "Spam listing",
    });

    const resolved = await service.resolveCase({
      caseId: c.id,
      actorId: "admin",
      status: "RESOLVED",
      resolution: "Removed",
    });
    expect(resolved.status).toBe("RESOLVED");
    expect(repo.audits.at(-1)).toMatchObject({ action: "MODERATION_RESOLVED", subjectId: "v1" });
  });

  it("refuses to resolve an already-closed case", async () => {
    const repo = new FakeModerationRepo();
    const service = new ModerationService(repo);
    const c = await service.report({
      reporterId: "r1",
      subjectType: "VENUE",
      subjectId: "v1",
      reason: "Spam listing",
    });
    await service.resolveCase({
      caseId: c.id,
      actorId: "admin",
      status: "DISMISSED",
      resolution: "ok",
    });
    await expect(
      service.resolveCase({ caseId: c.id, actorId: "admin", status: "RESOLVED", resolution: "x" }),
    ).rejects.toMatchObject({ code: "MODERATION_CASE_CLOSED" });
  });
});

describe("ModerationService.setSuspension", () => {
  it("suspends a venue and records the audit action", async () => {
    const repo = new FakeModerationRepo();
    const service = new ModerationService(repo);
    await service.setSuspension({
      actorId: "admin",
      subjectType: "VENUE",
      subjectId: "v1",
      suspended: true,
    });
    expect(repo.suspended.get("VENUE:v1")).toBe(true);
    expect(repo.audits.at(-1)).toMatchObject({ action: "SUBJECT_SUSPENDED", subjectId: "v1" });
  });

  it("refuses to suspend a review", async () => {
    const service = new ModerationService(new FakeModerationRepo());
    await expect(
      service.setSuspension({
        actorId: "admin",
        subjectType: "REVIEW",
        subjectId: "x",
        suspended: true,
      }),
    ).rejects.toMatchObject({ code: "MODERATION_NOT_SUSPENDABLE" });
  });
});
