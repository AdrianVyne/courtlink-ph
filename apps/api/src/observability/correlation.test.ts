import { describe, expect, it } from "vitest";
import { UUID_PATTERN, resolveCorrelationId, safeRequestPath } from "./correlation.js";

describe("resolveCorrelationId", () => {
  it("preserves a valid caller correlation ID", () => {
    const known = "e652a326-5f5a-46df-bbad-c771b18c3f9f";
    expect(resolveCorrelationId(known)).toBe(known);
  });

  it("generates a UUID when the caller value is absent or invalid", () => {
    expect(resolveCorrelationId(undefined)).toMatch(UUID_PATTERN);
    expect(resolveCorrelationId("not-a-uuid")).toMatch(UUID_PATTERN);
    expect(resolveCorrelationId(["e652a326-5f5a-46df-bbad-c771b18c3f9f"])).toMatch(UUID_PATTERN);
  });
});

describe("safeRequestPath", () => {
  it("removes query strings from logged request paths", () => {
    expect(safeRequestPath("/api/v1/courts?email=private@example.com")).toBe("/api/v1/courts");
  });
});
