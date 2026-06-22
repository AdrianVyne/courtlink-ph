import { createHash } from "node:crypto";

export type IdempotencyErrorCode =
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "IDEMPOTENCY_KEY_REUSED"
  | "IDEMPOTENCY_IN_PROGRESS";

export class IdempotencyError extends Error {
  constructor(
    readonly code: IdempotencyErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "IdempotencyError";
  }
}

export interface IdempotencyLookup {
  actorId: string;
  method: string;
  path: string;
  idempotencyKey: string;
  requestHash: string;
}

export interface IdempotencyRecord extends IdempotencyLookup {
  status: "IN_PROGRESS" | "COMPLETED";
  statusCode: number | null;
  responseBody: unknown;
}

export type IdempotencyResolution =
  | { kind: "execute" }
  | { kind: "replay"; statusCode: number; responseBody: unknown };

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
  return `{${entries.join(",")}}`;
}

export function canonicalRequestHash(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

export function resolveIdempotency(
  lookup: IdempotencyLookup,
  stored: IdempotencyRecord | null,
): IdempotencyResolution {
  if (!stored) {
    return { kind: "execute" };
  }
  if (stored.requestHash !== lookup.requestHash) {
    throw new IdempotencyError(
      "IDEMPOTENCY_KEY_REUSED",
      "Idempotency-Key was reused with a different request payload",
    );
  }
  if (stored.status === "IN_PROGRESS" || stored.statusCode === null) {
    throw new IdempotencyError(
      "IDEMPOTENCY_IN_PROGRESS",
      "A request with this Idempotency-Key is still being processed",
    );
  }
  return { kind: "replay", statusCode: stored.statusCode, responseBody: stored.responseBody };
}

export function requireIdempotencyKey(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new IdempotencyError("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required");
  }
  const key = value.trim();
  if (key.length > 200) {
    throw new IdempotencyError("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is too long");
  }
  return key;
}
