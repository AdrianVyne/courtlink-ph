import type { PrismaClient } from "@courtlink/database";
import type { IdempotencyLookup, IdempotencyRecord } from "./idempotency.service.js";

export interface ReservationOutcome {
  reserved: boolean;
  existing: IdempotencyRecord | null;
}

type Row = {
  actorId: string;
  method: string;
  path: string;
  idempotencyKey: string;
  requestHash: string;
  status: "IN_PROGRESS" | "COMPLETED";
  statusCode: number | null;
  responseBody: unknown;
};

function toRecord(row: Row): IdempotencyRecord {
  return {
    actorId: row.actorId,
    method: row.method,
    path: row.path,
    idempotencyKey: row.idempotencyKey,
    requestHash: row.requestHash,
    status: row.status,
    statusCode: row.statusCode,
    responseBody: row.responseBody ?? null,
  };
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = "code" in error ? String((error as { code: unknown }).code) : "";
  return code === "P2002" || code === "23505";
}

export class PrismaIdempotencyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async reserve(lookup: IdempotencyLookup): Promise<ReservationOutcome> {
    try {
      await this.prisma.idempotencyRecord.create({
        data: {
          actorId: lookup.actorId,
          method: lookup.method,
          path: lookup.path,
          idempotencyKey: lookup.idempotencyKey,
          requestHash: lookup.requestHash,
          status: "IN_PROGRESS",
        },
      });
      return { reserved: true, existing: null };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const existing = await this.find(lookup);
      return { reserved: false, existing };
    }
  }

  async find(lookup: IdempotencyLookup): Promise<IdempotencyRecord | null> {
    const row = await this.prisma.idempotencyRecord.findUnique({
      where: {
        actorId_method_path_idempotencyKey: {
          actorId: lookup.actorId,
          method: lookup.method,
          path: lookup.path,
          idempotencyKey: lookup.idempotencyKey,
        },
      },
    });
    return row ? toRecord(row as Row) : null;
  }

  async complete(
    lookup: IdempotencyLookup,
    statusCode: number,
    responseBody: unknown,
  ): Promise<void> {
    await this.prisma.idempotencyRecord.update({
      where: {
        actorId_method_path_idempotencyKey: {
          actorId: lookup.actorId,
          method: lookup.method,
          path: lookup.path,
          idempotencyKey: lookup.idempotencyKey,
        },
      },
      data: {
        status: "COMPLETED",
        statusCode,
        responseBody: (responseBody ?? null) as object,
      },
    });
  }

  async release(lookup: IdempotencyLookup): Promise<void> {
    await this.prisma.idempotencyRecord.deleteMany({
      where: {
        actorId: lookup.actorId,
        method: lookup.method,
        path: lookup.path,
        idempotencyKey: lookup.idempotencyKey,
        status: "IN_PROGRESS",
      },
    });
  }

  async pruneOlderThan(cutoff: Date): Promise<number> {
    const result = await this.prisma.idempotencyRecord.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return result.count;
  }
}
