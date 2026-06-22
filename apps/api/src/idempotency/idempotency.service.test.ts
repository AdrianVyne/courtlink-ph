import { describe, expect, it } from "vitest";
import {
  IdempotencyError,
  canonicalRequestHash,
  requireIdempotencyKey,
  resolveIdempotency,
  type IdempotencyRecord,
} from "./idempotency.service.js";

const baseLookup = {
  actorId: "actor-1",
  method: "POST",
  path: "/courts/c1/hold",
  idempotencyKey: "key-1",
  requestHash: canonicalRequestHash({ startsAt: "a", endsAt: "b" }),
};

function completed(overrides: Partial<IdempotencyRecord> = {}): IdempotencyRecord {
  return {
    ...baseLookup,
    status: "COMPLETED",
    statusCode: 201,
    responseBody: { id: "booking-1" },
    ...overrides,
  };
}

describe("canonicalRequestHash", () => {
  it("is stable regardless of key order", () => {
    expect(canonicalRequestHash({ a: 1, b: 2 })).toBe(canonicalRequestHash({ b: 2, a: 1 }));
  });

  it("differs when values differ", () => {
    expect(canonicalRequestHash({ a: 1 })).not.toBe(canonicalRequestHash({ a: 2 }));
  });
});

describe("resolveIdempotency", () => {
  it("executes when no record exists", () => {
    expect(resolveIdempotency(baseLookup, null)).toEqual({ kind: "execute" });
  });

  it("replays a stored response when key and hash match", () => {
    expect(resolveIdempotency(baseLookup, completed())).toEqual({
      kind: "replay",
      statusCode: 201,
      responseBody: { id: "booking-1" },
    });
  });

  it("rejects reuse of a key with a different request hash", () => {
    const stored = completed({ requestHash: canonicalRequestHash({ startsAt: "x", endsAt: "y" }) });
    try {
      resolveIdempotency(baseLookup, stored);
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(IdempotencyError);
      expect((error as IdempotencyError).code).toBe("IDEMPOTENCY_KEY_REUSED");
    }
  });

  it("rejects a still-in-progress request", () => {
    const stored = completed({ status: "IN_PROGRESS", statusCode: null, responseBody: null });
    try {
      resolveIdempotency(baseLookup, stored);
      throw new Error("expected throw");
    } catch (error) {
      expect((error as IdempotencyError).code).toBe("IDEMPOTENCY_IN_PROGRESS");
    }
  });
});

describe("requireIdempotencyKey", () => {
  it("returns a trimmed key", () => {
    expect(requireIdempotencyKey("  abc  ")).toBe("abc");
  });

  it("rejects missing or blank keys", () => {
    for (const value of [undefined, null, "", "   "]) {
      try {
        requireIdempotencyKey(value);
        throw new Error("expected throw");
      } catch (error) {
        expect((error as IdempotencyError).code).toBe("IDEMPOTENCY_KEY_REQUIRED");
      }
    }
  });

  it("rejects an oversized key", () => {
    expect(() => requireIdempotencyKey("x".repeat(201))).toThrow(IdempotencyError);
  });
});
