import { describe, expect, it } from "vitest";
import { parseRedisMemoryInfo } from "./prisma-operations.probe.js";

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
