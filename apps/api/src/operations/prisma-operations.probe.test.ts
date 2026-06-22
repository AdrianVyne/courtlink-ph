import { describe, expect, it } from "vitest";
import { parseRedisMemoryInfo, sanitizeFailureReason } from "./prisma-operations.probe.js";

describe("parseRedisMemoryInfo", () => {
  it("extracts used and configured maximum bytes", () => {
    expect(parseRedisMemoryInfo("# Memory\r\nused_memory:1024\r\nmaxmemory:4096\r\n")).toEqual({
      usedBytes: 1024,
      maxBytes: 4096,
    });
  });

  it("treats an unlimited Redis maxmemory as unavailable capacity", () => {
    expect(parseRedisMemoryInfo("used_memory:1024\r\nmaxmemory:0\r\n")).toEqual({
      usedBytes: 1024,
      maxBytes: 0,
    });
  });
});

describe("sanitizeFailureReason", () => {
  it("redacts personal data and URLs and bounds output", () => {
    const reason = `Failed for player@example.com at https://private.example/proof ${"x".repeat(300)}`;
    const sanitized = sanitizeFailureReason(reason);

    expect(sanitized).not.toContain("player@example.com");
    expect(sanitized).not.toContain("https://private.example/proof");
    expect(sanitized.length).toBeLessThanOrEqual(203);
  });
});
