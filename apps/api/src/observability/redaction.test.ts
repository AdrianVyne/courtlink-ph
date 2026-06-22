import { describe, expect, it } from "vitest";
import { redactLogValue } from "./redaction.js";

describe("redactLogValue", () => {
  it("recursively redacts secrets, payment details, proof locations, and personal data", () => {
    expect(
      redactLogValue({
        cookie: "session=secret",
        authorization: "Bearer token",
        transactionRef: "GCASH-123",
        proofUrl: "https://private.example/proof",
        email: "player@example.com",
        nested: { count: 2, accessKey: "key", values: [{ phone: "09170000000" }] },
      }),
    ).toEqual({
      cookie: "[REDACTED]",
      authorization: "[REDACTED]",
      transactionRef: "[REDACTED]",
      proofUrl: "[REDACTED]",
      email: "[REDACTED]",
      nested: { count: 2, accessKey: "[REDACTED]", values: [{ phone: "[REDACTED]" }] },
    });
  });

  it("bounds strings and preserves operational scalar values", () => {
    expect(redactLogValue({ message: "x".repeat(600), count: 3, ready: true })).toEqual({
      message: `${"x".repeat(500)}...`,
      count: 3,
      ready: true,
    });
  });
});
