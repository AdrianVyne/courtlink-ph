import { describe, expect, it } from "vitest";
import {
  MAX_PROOF_BYTES,
  StorageValidationError,
  assertProofContentType,
  assertProofSize,
  buildProofObjectKey,
} from "./object-storage.js";

describe("proof content validation", () => {
  it("accepts supported image types", () => {
    expect(assertProofContentType("image/png")).toBe("image/png");
    expect(assertProofContentType("image/jpeg")).toBe("image/jpeg");
    expect(assertProofContentType("image/webp")).toBe("image/webp");
  });

  it("rejects unsupported types", () => {
    expect(() => assertProofContentType("application/pdf")).toThrow(StorageValidationError);
    expect(() => assertProofContentType("image/gif")).toThrow(
      expect.objectContaining({ code: "PROOF_TYPE_UNSUPPORTED" }),
    );
  });

  it("rejects empty and oversized files", () => {
    expect(() => assertProofSize(0)).toThrow(expect.objectContaining({ code: "PROOF_EMPTY" }));
    expect(() => assertProofSize(MAX_PROOF_BYTES + 1)).toThrow(
      expect.objectContaining({ code: "PROOF_TOO_LARGE" }),
    );
    expect(() => assertProofSize(1024)).not.toThrow();
  });
});

describe("buildProofObjectKey", () => {
  it("namespaces keys by scope and booking with the right extension", () => {
    const key = buildProofObjectKey("court", "booking-1", "image/jpeg");
    expect(key).toMatch(/^proofs\/court\/booking-1\/[0-9a-f-]{36}\.jpg$/);
  });

  it("separates court and coach proofs", () => {
    const coachKey = buildProofObjectKey("coach", "cbk-1", "image/webp");
    expect(coachKey.startsWith("proofs/coach/cbk-1/")).toBe(true);
    expect(coachKey.endsWith(".webp")).toBe(true);
  });
});
